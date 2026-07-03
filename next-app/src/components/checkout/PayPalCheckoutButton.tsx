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
  missingFields,
  getPayload,
  onOrderId,
  onSuccess,
}: {
  clientId: string;
  currency?: string;
  ready: boolean;
  isEs: boolean;
  /** Labels of required fields that are currently empty, in form order — shown
   *  in the required-fields modal so the buyer knows exactly what to fill in. */
  missingFields: string[];
  getPayload: () => PayPalPayload;
  onOrderId: (orderId: string) => void;
  onSuccess: (result: { orderId: string; orderNumber: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showRequiredFieldsModal, setShowRequiredFieldsModal] = useState(false);

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
          setShowRequiredFieldsModal(true);
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
        // The buyer approved (hit Pay Now) in the PayPal window — capture the
        // payment now so the sale completes here, then the parent shows the
        // order confirmation screen.
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
            ? 'Pago cancelado. Puede intentarlo de nuevo cuando esté listo.'
            : 'Payment canceled. You can try again whenever you are ready.',
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
            ? 'Complete los datos requeridos para continuar al pago.'
            : 'Complete the required details to continue to payment.'}
        </p>
      )}
      {processing && (
        <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {isEs
            ? 'Procesando su pago… Para cancelar, cierre la ventana de PayPal con la × en la esquina.'
            : 'Processing your payment… To cancel, close the PayPal window using the × in the corner.'}
        </p>
      )}
      {message && (
        <p className="mt-2 text-sm" style={{ color: 'var(--color-error)' }}>
          {message}
        </p>
      )}

      {showRequiredFieldsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isEs ? 'Campos requeridos' : 'Required fields'}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: '1.25rem',
            background: 'rgba(20, 18, 14, 0.45)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              width: 'min(26rem, 100%)',
              background: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(115, 92, 0, 0.16)',
              boxShadow: '0 28px 80px rgba(20, 18, 14, 0.24)',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '2rem', color: 'var(--color-error)' }}>
              error
            </span>
            <p style={{ marginTop: '0.75rem', fontSize: '0.95rem', color: 'var(--color-on-surface)' }}>
              {isEs
                ? 'Complete los siguientes campos requeridos antes de pagar:'
                : 'Please complete the following required fields before paying:'}
            </p>
            {missingFields.length > 0 && (
              <ul style={{ marginTop: '0.75rem', textAlign: 'left', display: 'inline-block', fontSize: '0.9rem', color: 'var(--color-on-surface)' }}>
                {missingFields.map((field) => (
                  <li key={field} style={{ padding: '0.15rem 0' }}>{field}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setShowRequiredFieldsModal(false)}
              className="gold-button justify-center text-sm"
              style={{ marginTop: '1.25rem', width: '100%' }}
            >
              {isEs ? 'Cerrar' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
