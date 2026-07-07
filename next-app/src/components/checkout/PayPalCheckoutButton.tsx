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

// Fire-and-forget: tell the server to soft-cancel the unpaid order the buyer
// just abandoned. `keepalive` lets the request survive a page/tab teardown.
function cancelAbandonedOrder(orderId: string | null) {
  if (!orderId) return;
  try {
    void fetch('/api/paypal/cancel-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore — best effort */
  }
}

export type PayPalPayload = {
  items: { id: string; quantity: number }[];
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
  needsInfoConfirmation,
  getPayload,
  onOrderId,
  onSuccess,
}: {
  clientId: string;
  currency?: string;
  ready: boolean;
  isEs: boolean;
  /** Labels of required *form fields* that are currently empty, in form order
   *  (the confirmation checkbox is tracked separately via needsInfoConfirmation). */
  missingFields: string[];
  /** True when the "confirm my information" checkbox is not yet checked. */
  needsInfoConfirmation: boolean;
  getPayload: () => PayPalPayload;
  onOrderId: (orderId: string) => void;
  onSuccess: (result: { orderId: string; orderNumber: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  // Inline red reminder shown when the buyer clicks pay before completing the
  // required fields / confirmation checkbox (replaces the old full-screen modal).
  const [missingHint, setMissingHint] = useState<{ fields: string[]; needsConfirm: boolean } | null>(null);

  // Keep the latest callbacks/getters in refs so the PayPal Buttons instance
  // (initialized once) always reads current cart + contact state.
  const getPayloadRef = useRef(getPayload);
  const onOrderIdRef = useRef(onOrderId);
  const onSuccessRef = useRef(onSuccess);
  // Internal order id created by the most recent create-order call. Used to
  // cancel the lingering unpaid order if the buyer abandons the PayPal window.
  const createdOrderIdRef = useRef<string | null>(null);
  const isEsRef = useRef(isEs);
  const readyRef = useRef(ready);
  const missingFieldsRef = useRef(missingFields);
  const needsInfoConfirmationRef = useRef(needsInfoConfirmation);
  useEffect(() => {
    getPayloadRef.current = getPayload;
    onOrderIdRef.current = onOrderId;
    onSuccessRef.current = onSuccess;
    isEsRef.current = isEs;
    readyRef.current = ready;
    missingFieldsRef.current = missingFields;
    needsInfoConfirmationRef.current = needsInfoConfirmation;
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
          setMissingHint({ fields: missingFieldsRef.current, needsConfirm: needsInfoConfirmationRef.current });
          return actions.reject();
        }
        setMissingHint(null);
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
          if (data.orderId) {
            createdOrderIdRef.current = data.orderId as string;
            onOrderIdRef.current(data.orderId);
          }
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
          // Paid — this order must never be cancelled by a later unmount.
          createdOrderIdRef.current = null;
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
        // Buyer closed / cancelled the PayPal window before approving. Cancel the
        // unpaid order that create-order already wrote so it doesn't linger in the
        // admin as an open sale. Keep the id: an immediate retry reuses this order.
        cancelAbandonedOrder(createdOrderIdRef.current);
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

  // Compose the reminder shown when the buyer tries to pay before they're ready —
  // leads with the confirmation checkbox (the most-missed step) and lists any empty
  // form fields.
  function reminderMessage(hint: { fields: string[]; needsConfirm: boolean }): string {
    const parts: string[] = [];
    if (hint.needsConfirm) {
      parts.push(isEs
        ? 'marque la casilla de arriba para confirmar que su información es correcta'
        : 'check the box above to confirm your information is correct');
    }
    if (hint.fields.length > 0) {
      parts.push(isEs
        ? `complete: ${hint.fields.join(', ')}`
        : `complete: ${hint.fields.join(', ')}`);
    }
    if (parts.length === 0) {
      return isEs ? 'Complete los datos requeridos para pagar.' : 'Complete the required details to pay.';
    }
    const joined = parts.join(isEs ? '; y ' : '; and ');
    return isEs ? `Antes de pagar, ${joined}.` : `Before you can pay, please ${joined}.`;
  }

  return (
    <div>
      {missingHint && !ready && (
        <div
          role="alert"
          className="mb-2 flex items-start gap-2 text-sm"
          style={{
            padding: '0.6rem 0.75rem',
            border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)',
            background: 'color-mix(in srgb, var(--color-error) 9%, transparent)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-error)',
            fontWeight: 600,
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '1.15rem', lineHeight: 1.25, flexShrink: 0 }}>
            error
          </span>
          <span>{reminderMessage(missingHint)}</span>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <div
          ref={containerRef}
          aria-busy={processing}
          style={{
            opacity: sdkReady && !ready ? 0.5 : 1,
            transition: 'opacity 150ms ease',
          }}
        />
        {/* Until the buyer is ready, an invisible overlay swallows the click so
            the PayPal flow never starts (no popup flash / jolt) — it just shows
            the reminder. Removed once ready, so real clicks reach the button. */}
        {sdkReady && !ready && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={isEs ? 'Complete los datos requeridos para pagar' : 'Complete the required details before paying'}
            onClick={() => setMissingHint({ fields: missingFields, needsConfirm: needsInfoConfirmation })}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'not-allowed',
              zIndex: 5,
            }}
          />
        )}
      </div>
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
    </div>
  );
}
