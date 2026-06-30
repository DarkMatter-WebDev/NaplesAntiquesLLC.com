'use client';

import { useEffect, useRef, useState } from 'react';

type PayPalButtonsActions = { resolve: () => Promise<void>; reject: () => Promise<void> };
type PayPalButtonsConfig = {
  style?: Record<string, unknown>;
  onClick?: (data: Record<string, unknown>, actions: PayPalButtonsActions) => Promise<void> | void;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
};

type PayPalNamespace = {
  Buttons: (config: PayPalButtonsConfig) => {
    render: (container: HTMLElement) => Promise<void>;
    close?: () => void;
  };
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

const sdkPromises: Record<string, Promise<void> | undefined> = {};

function loadPayPalSdk(clientId: string, currency: string): Promise<void> {
  const key = `${clientId}:${currency}`;
  if (typeof window !== 'undefined' && window.paypal) return Promise.resolve();
  const existing = sdkPromises[key];
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const params = new URLSearchParams({
      'client-id': clientId,
      currency,
      intent: 'capture',
      components: 'buttons',
      'disable-funding': 'paylater,credit',
    });
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      delete sdkPromises[key];
      reject(new Error('Failed to load PayPal SDK'));
    };
    document.body.appendChild(script);
  });
  sdkPromises[key] = promise;
  return promise;
}

export type PayPalPayload = {
  productIds: string[];
  customer: Record<string, unknown>;
  shippingMethod: string;
  orderId: string | null;
};

export default function PayPalCheckoutButton({
  clientId,
  currency = 'USD',
  ready,
  isEs,
  getPayload,
  onOrderId,
  onSuccess,
}: {
  clientId: string;
  currency?: string;
  ready: boolean;
  isEs: boolean;
  getPayload: () => PayPalPayload;
  onOrderId: (orderId: string) => void;
  onSuccess: (result: { orderId: string; orderNumber: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Keep the latest callbacks/getters in refs so the PayPal Buttons instance
  // (initialized once) always reads current cart + contact state.
  const getPayloadRef = useRef(getPayload);
  const onOrderIdRef = useRef(onOrderId);
  const onSuccessRef = useRef(onSuccess);
  const isEsRef = useRef(isEs);
  const readyRef = useRef(ready);
  useEffect(() => {
    getPayloadRef.current = getPayload;
    onOrderIdRef.current = onOrderId;
    onSuccessRef.current = onSuccess;
    isEsRef.current = isEs;
    readyRef.current = ready;
  });

  useEffect(() => {
    let active = true;
    loadPayPalSdk(clientId, currency)
      .then(() => { if (active) setSdkReady(true); })
      .catch(() => { if (active) setSdkError(true); });
    return () => { active = false; };
  }, [clientId, currency]);

  useEffect(() => {
    if (!sdkReady || !containerRef.current || !window.paypal) return;
    const container = containerRef.current;
    let closed = false;

    const buttons = window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'paypal' },
      // Validate contact details before opening the PayPal window. The buttons are
      // always visible; if the form isn't filled, reject the click and prompt.
      onClick: (_data, actions) => {
        if (!readyRef.current) {
          setMessage(
            isEsRef.current
              ? 'Complete los campos requeridos arriba antes de pagar.'
              : 'Please complete the required fields above before paying.',
          );
          return actions.reject();
        }
        setMessage(null);
        return actions.resolve();
      },
      createOrder: async () => {
        setMessage(null);
        setProcessing(true);
        try {
          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getPayloadRef.current()),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.paypalOrderId) {
            throw new Error(data?.error ?? 'create-order failed');
          }
          if (data.orderId) onOrderIdRef.current(data.orderId);
          return data.paypalOrderId as string;
        } catch (err) {
          setProcessing(false);
          setMessage(
            isEsRef.current
              ? 'No se pudo iniciar el pago. Verifique su carrito e intente de nuevo.'
              : 'Could not start payment. Please check your cart and try again.',
          );
          throw err;
        }
      },
      onApprove: async (data) => {
        try {
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paypalOrderId: data.orderID }),
          });
          const result = await res.json().catch(() => null);
          if (!res.ok || !result?.success) {
            throw new Error(result?.error ?? 'capture failed');
          }
          onSuccessRef.current({ orderId: result.orderId, orderNumber: result.orderNumber });
        } catch {
          setProcessing(false);
          setMessage(
            isEsRef.current
              ? 'No pudimos confirmar su pago. Si se le cobró, contáctenos y lo resolveremos.'
              : 'We could not confirm your payment. If you were charged, contact us and we will resolve it.',
          );
        }
      },
      onCancel: () => {
        setProcessing(false);
        setMessage(
          isEsRef.current
            ? 'Pago cancelado. Sus artículos siguen reservados por poco tiempo.'
            : 'Payment canceled. Your items are still reserved for a short time.',
        );
      },
      onError: () => {
        setProcessing(false);
        setMessage(
          isEsRef.current
            ? 'Ocurrió un problema con PayPal. Intente de nuevo.'
            : 'Something went wrong with PayPal. Please try again.',
        );
      },
    });

    buttons.render(container).catch(() => {
      if (!closed) setSdkError(true);
    });

    return () => {
      closed = true;
      try {
        buttons.close?.();
      } catch {
        /* ignore */
      }
      container.innerHTML = '';
    };
  }, [sdkReady]);

  if (sdkError) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-error)' }}>
        {isEs
          ? 'No se pudo cargar PayPal. Actualice la página o intente más tarde.'
          : 'PayPal could not load. Please refresh the page or try again later.'}
      </p>
    );
  }

  return (
    <div>
      <div ref={containerRef} aria-busy={processing} />
      {!sdkReady && (
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Cargando PayPal…' : 'Loading PayPal…'}
        </p>
      )}
      {sdkReady && !ready && (
        <p className="mt-2 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'Complete los datos requeridos arriba para continuar al pago.'
            : 'Complete the required details above to continue to payment.'}
        </p>
      )}
      {processing && (
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs ? 'Procesando su pago…' : 'Processing your payment…'}
        </p>
      )}
      {message && (
        <p className="mt-2 text-sm" style={{ color: 'var(--color-error)' }}>
          {message}
        </p>
      )}
    </div>
  );
}
