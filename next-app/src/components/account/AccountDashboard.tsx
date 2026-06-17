'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import AccountProfileForm, { type CustomerProfile } from '@/components/account/AccountProfileForm';
import SignOutButton from '@/components/account/SignOutButton';
import { createClient } from '@/lib/supabase/client';
import { useWishlist } from '@/context/WishlistContext';
import { formatCurrency, formatOrderDate, orderStatusLabel, type Order } from '@/types/sales';

type AccountTab = 'overview' | 'orders' | 'wishlist';
type AccountSection = AccountTab | 'security';

interface Props {
  profile: CustomerProfile;
  fallbackEmail: string | null;
  locale: string;
  isAdmin: boolean;
  memberSince: string;
  orders: Order[];
}

export default function AccountDashboard({
  profile,
  fallbackEmail,
  locale,
  isAdmin,
  memberSince,
  orders,
}: Props) {
  const isEs = locale === 'es';
  const [activeTab, setActiveTab] = useState<AccountTab>(() => {
    if (typeof window === 'undefined') return 'overview';
    const tab = new URLSearchParams(window.location.search).get('tab');
    return tab === 'orders' || tab === 'wishlist' ? tab : 'overview';
  });

  function selectTab(tab: AccountTab) {
    setActiveTab(tab);
    if (typeof window === 'undefined') return;
    const url = tab === 'overview' ? window.location.pathname : `${window.location.pathname}?tab=${tab}`;
    window.history.replaceState(null, '', url);
  }

  return (
    <div className="account-content max-w-6xl mx-auto px-4 md:px-8">
      <AccountTabs activeSection={activeTab} locale={locale} onSelectTab={selectTab} />

      <section id="account-overview" className="account-dashboard-grid">
        <div className="account-overview-panel">
          {activeTab === 'overview' && (
            <AccountTabShell
              eyebrow={isEs ? 'Resumen de cuenta' : 'Account Overview'}
              title={isEs ? 'Tu informacion principal' : 'Your main account information'}
              copy={isEs ? 'Una vista rapida de tu perfil, datos de contacto y preferencias.' : 'A quick view of your profile, contact details, and preferences.'}
              action={
                <SignOutButton
                  label={isEs ? 'Cerrar Sesion' : 'Sign Out'}
                  locale={locale}
                  className="account-heading-signout"
                />
              }
            >
              <AccountProfileForm profile={profile} fallbackEmail={fallbackEmail} locale={locale} />
            </AccountTabShell>
          )}

          {activeTab === 'orders' && <OrdersTab orders={orders} locale={locale} />}
          {activeTab === 'wishlist' && <WishlistTab locale={locale} />}
        </div>

        <AccountSideRail locale={locale} fallbackEmail={fallbackEmail} isAdmin={isAdmin} memberSince={memberSince} />
      </section>

      <AccountSupportStrip locale={locale} />
    </div>
  );
}

export function AccountTabs({
  activeSection,
  locale,
  onSelectTab,
}: {
  activeSection: AccountSection;
  locale: string;
  onSelectTab?: (tab: AccountTab) => void;
}) {
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';
  const tabs: { key: AccountSection; icon: string; label: string; href: string }[] = [
    { key: 'overview', icon: 'person', label: isEs ? 'Resumen' : 'Overview', href: `${prefix}/account` },
    { key: 'orders', icon: 'inventory_2', label: isEs ? 'Pedidos' : 'Orders', href: `${prefix}/account?tab=orders` },
    { key: 'wishlist', icon: 'favorite', label: isEs ? 'Favoritos' : 'Wishlist', href: `${prefix}/account?tab=wishlist` },
    { key: 'security', icon: 'admin_panel_settings', label: isEs ? 'Admin y seguridad' : 'Admin and Security', href: `${prefix}/account/security` },
  ];

  return (
    <nav className="account-tabs" aria-label={isEs ? 'Menu de cuenta' : 'Account menu'}>
      {tabs.map((tab) => {
        const isActive = activeSection === tab.key;
        const contents = (
          <>
            <span className="material-symbols-outlined" aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </>
        );

        if (tab.key === 'overview' || tab.key === 'orders' || tab.key === 'wishlist') {
          const accountTab = tab.key as AccountTab;
          if (!onSelectTab) {
            return (
              <Link key={tab.key} href={tab.href} className={isActive ? 'active' : ''} aria-current={isActive ? 'page' : undefined}>
                {contents}
              </Link>
            );
          }

          return (
            <button
              key={tab.key}
              type="button"
              className={isActive ? 'active' : ''}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectTab(accountTab)}
            >
              {contents}
            </button>
          );
        }

        return (
          <Link key={tab.key} href={tab.href} className={isActive ? 'active' : ''} aria-current={isActive ? 'page' : undefined}>
            {contents}
          </Link>
        );
      })}
    </nav>
  );
}

export function AccountSupportStrip({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const contactHref = isEs ? '/es/contact' : '/contact';

  return (
    <section className="account-support-strip">
      <div>
        <h2>{isEs ? 'Necesitas ayuda?' : 'Need Help?'}</h2>
        <p>{isEs ? 'Nuestro equipo esta aqui para ayudarte.' : 'Our support team is here to help.'}</p>
      </div>
      <div className="account-support-item">
        <span className="material-symbols-outlined" aria-hidden="true">call</span>
        <div>
          <strong>{isEs ? 'Llamanos' : 'Call Us'}</strong>
          <a href="tel:2394048505">(239) 404-8505</a>
        </div>
      </div>
      <div className="account-support-item">
        <span className="material-symbols-outlined" aria-hidden="true">mail</span>
        <div>
          <strong>{isEs ? 'Escribenos' : 'Email Us'}</strong>
          <a href="mailto:info@naplesestatejewelry.co">info@naplesestatejewelry.co</a>
        </div>
      </div>
      <Link href={contactHref} className="gold-button text-sm account-arrow-button">
        {isEs ? 'Contactar soporte' : 'Contact Support'}
        <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </Link>
    </section>
  );
}

export function AccountSideRail({
  locale,
  fallbackEmail,
  isAdmin,
  memberSince,
}: {
  locale: string;
  fallbackEmail: string | null;
  isAdmin: boolean;
  memberSince: string;
}) {
  const isEs = locale === 'es';
  const shopHref = isEs ? '/es/shop' : '/shop';

  return (
    <aside className="account-side-rail" aria-label={isEs ? 'Acciones de cuenta' : 'Account actions'}>
      {isAdmin && (
        <div className="account-card account-side-card account-admin-card">
          <div className="account-card-icon" aria-hidden="true">
            <span className="material-symbols-outlined">admin_panel_settings</span>
          </div>
          <div>
            <h2>{isEs ? 'Panel de Administracion' : 'Admin Panel'}</h2>
            <p>{isEs ? 'Gestionar productos, imagenes y precios.' : 'Manage products, images, and pricing.'}</p>
            <Link href={isEs ? '/es/admin' : '/admin'} className="gold-button text-sm account-arrow-button">
              {isEs ? 'Abrir Admin' : 'Open Admin Panel'}
              <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </Link>
          </div>
        </div>
      )}

      <div className="account-card account-side-card">
        <h2>{isEs ? 'Detalles de cuenta' : 'Account Details'}</h2>
        <p>{isEs ? 'Configuracion y preferencias principales.' : 'Manage your account settings and preferences.'}</p>
        <div className="account-detail-grid">
          <div>
            <span>{isEs ? 'Correo' : 'Email'}</span>
            <strong>{fallbackEmail}</strong>
          </div>
          <div>
            <span>{isEs ? 'Tipo de cuenta' : 'Account type'}</span>
            <strong>{isAdmin ? (isEs ? 'Administrador' : 'Administrator') : (isEs ? 'Miembro' : 'Member')}</strong>
          </div>
          <div>
            <span>{isEs ? 'Miembro desde' : 'Member since'}</span>
            <strong>{memberSince}</strong>
          </div>
        </div>
        <SignOutButton
          label={isEs ? 'Cerrar Sesion' : 'Sign Out'}
          locale={locale}
        />
      </div>

      <div className="account-card account-side-card account-shop-card">
        <div>
          <h2>{isEs ? 'Comprar ahora' : 'Shop Now'}</h2>
          <p>{isEs ? 'Explora las ultimas colecciones.' : 'Browse our latest collections.'}</p>
          <Link href={shopHref} className="outline-button text-sm account-arrow-button">
            {isEs ? 'Ver tienda' : 'Browse Shop'}
            <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </Link>
        </div>
        <span className="material-symbols-outlined" aria-hidden="true">redeem</span>
      </div>
    </aside>
  );
}

function AccountTabShell({
  eyebrow,
  title,
  copy,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="account-tab-stack">
      <div className="account-tab-heading">
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
          <span>{copy}</span>
        </div>
        {action && <div className="account-tab-heading-action">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function OrdersTab({ orders, locale }: { orders: Order[]; locale: string }) {
  const isEs = locale === 'es';
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <div className="account-card account-tab-card">
      <p className="account-tab-eyebrow">{isEs ? 'Pedidos' : 'Orders'}</p>
      <h2>{isEs ? 'Historial de pedidos' : 'Order History'}</h2>
      <p>{isEs ? 'Revisa tus pedidos y estados recientes.' : 'Review your recent order totals and statuses.'}</p>
      {orders.length === 0 ? (
        <div className="account-empty-state">
          <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
          <strong>{isEs ? 'Sin pedidos todavia' : 'No orders yet'}</strong>
          <p>{isEs ? 'Cuando hagas una compra, aparecera aqui.' : 'When you place a purchase, it will appear here.'}</p>
        </div>
      ) : (
        <div className="account-order-list">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              className="account-order-row"
              onClick={() => setSelectedOrder(order)}
              aria-label={isEs ? `Ver detalles del pedido ${order.order_number}` : `View details for order ${order.order_number}`}
            >
              <div>
                <strong>{order.order_number}</strong>
                <span>{formatOrderDate(order.created_at)}</span>
              </div>
              <div>
                <span>{isEs ? 'Pago' : 'Payment'}</span>
                <strong>{orderStatusLabel(order.payment_status)}</strong>
              </div>
              <div>
                <span>{isEs ? 'Estado' : 'Status'}</span>
                <strong>{orderStatusLabel(order.order_status)}</strong>
              </div>
              <div>
                <span>{isEs ? 'Total' : 'Total'}</span>
                <strong>{formatCurrency(order.total)}</strong>
              </div>
              <span className="material-symbols-outlined account-order-row-icon" aria-hidden="true">chevron_right</span>
            </button>
          ))}
        </div>
      )}
      {selectedOrder && (
        <OrderDetailsDialog order={selectedOrder} locale={locale} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

function OrderDetailsDialog({
  order,
  locale,
  onClose,
}: {
  order: Order;
  locale: string;
  onClose: () => void;
}) {
  const isEs = locale === 'es';
  const itemCount = order.order_items?.length ?? 0;

  return (
    <div className="account-order-dialog-backdrop" role="dialog" aria-modal="true" aria-label={isEs ? 'Detalles del pedido' : 'Order details'}>
      <div className="account-order-dialog">
        <button type="button" className="account-order-dialog-close" onClick={onClose} aria-label={isEs ? 'Cerrar detalles del pedido' : 'Close order details'}>
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>

        <div className="account-order-dialog-header">
          <p className="account-tab-eyebrow">{isEs ? 'Pedido' : 'Order'}</p>
          <h2>{order.order_number}</h2>
          <span>{formatOrderDate(order.created_at)}</span>
        </div>

        <div className="account-order-detail-grid">
          <OrderDetailBlock label={isEs ? 'Pago' : 'Payment'} value={orderStatusLabel(order.payment_status)} />
          <OrderDetailBlock label={isEs ? 'Estado' : 'Status'} value={orderStatusLabel(order.order_status)} />
          <OrderDetailBlock label={isEs ? 'Cumplimiento' : 'Fulfillment'} value={orderStatusLabel(order.fulfillment_status)} />
          <OrderDetailBlock label={isEs ? 'Entrega' : 'Delivery'} value={orderStatusLabel(order.shipping_method)} />
        </div>

        <div className="account-order-dialog-section">
          <h3>{isEs ? 'Articulos' : 'Items'}</h3>
          {itemCount === 0 ? (
            <p className="account-order-muted">{isEs ? 'No hay articulos guardados para este pedido.' : 'No saved items are attached to this order.'}</p>
          ) : (
            <div className="account-order-item-list">
              {order.order_items?.map((item) => (
                <div key={item.id} className="account-order-item">
                  <div className="account-order-item-image">
                    {item.image_snapshot ? (
                      <Image src={item.image_snapshot} alt={item.title_snapshot} fill sizes="96px" className="object-contain" unoptimized={item.image_snapshot.startsWith('/assets/')} />
                    ) : (
                      <span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>
                    )}
                  </div>
                  <div>
                    <strong>{item.title_snapshot}</strong>
                    <span>
                      {[item.inventory_number ? `#${item.inventory_number}` : null, item.metal_snapshot, item.purity_snapshot, item.gram_weight_snapshot ? `${item.gram_weight_snapshot}g` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <b>{formatCurrency(item.price_snapshot)}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="account-order-dialog-columns">
          <div className="account-order-dialog-section">
            <h3>{isEs ? 'Cliente' : 'Customer'}</h3>
            <OrderDetailLine label={isEs ? 'Nombre' : 'Name'} value={order.customer_name} />
            <OrderDetailLine label={isEs ? 'Correo' : 'Email'} value={order.customer_email} />
            <OrderDetailLine label={isEs ? 'Telefono' : 'Phone'} value={order.customer_phone} />
          </div>
          <div className="account-order-dialog-section">
            <h3>{isEs ? 'Totales' : 'Totals'}</h3>
            <OrderDetailLine label={isEs ? 'Subtotal' : 'Subtotal'} value={formatCurrency(order.subtotal)} />
            <OrderDetailLine label={isEs ? 'Impuesto' : 'Tax'} value={formatCurrency(order.tax)} />
            <OrderDetailLine label={isEs ? 'Envio' : 'Shipping'} value={formatCurrency(order.shipping_fee)} />
            {order.discount > 0 && <OrderDetailLine label={isEs ? 'Descuento' : 'Discount'} value={`-${formatCurrency(order.discount)}`} />}
            <OrderDetailLine label={isEs ? 'Total' : 'Total'} value={formatCurrency(order.total)} strong />
          </div>
        </div>

        {(order.customer_notes || order.shipping_address || order.billing_address) && (
          <div className="account-order-dialog-section">
            <h3>{isEs ? 'Detalles adicionales' : 'Additional Details'}</h3>
            <OrderDetailLine label={isEs ? 'Notas' : 'Notes'} value={order.customer_notes} />
            <OrderDetailLine label={isEs ? 'Direccion de entrega' : 'Shipping address'} value={formatAddress(order.shipping_address)} />
            <OrderDetailLine label={isEs ? 'Direccion de facturacion' : 'Billing address'} value={formatAddress(order.billing_address)} />
          </div>
        )}
      </div>
    </div>
  );
}

function OrderDetailBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function OrderDetailLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string | number | null | undefined;
  strong?: boolean;
}) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={strong ? 'account-order-detail-line strong' : 'account-order-detail-line'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatAddress(address: Record<string, unknown> | null): string | null {
  if (!address) return null;
  const parts = ['address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country']
    .map((key) => address[key])
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map((value) => String(value).trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function WishlistTab({ locale }: { locale: string }) {
  const { items, remove } = useWishlist();
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';

  return (
    <div className="account-card account-tab-card">
      <p className="account-tab-eyebrow">{isEs ? 'Favoritos' : 'Wishlist'}</p>
      <h2>{isEs ? 'Piezas guardadas' : 'Saved Pieces'}</h2>
      <p>{isEs ? 'Tus piezas guardadas desde la tienda.' : 'Your saved items from the shop.'}</p>
      {items.length === 0 ? (
        <div className="account-empty-state">
          <span className="material-symbols-outlined" aria-hidden="true">favorite</span>
          <strong>{isEs ? 'Sin favoritos todavia' : 'No saved items yet'}</strong>
          <p>{isEs ? 'Toca el corazon en una pieza para guardarla aqui.' : 'Tap the heart on a piece to save it here.'}</p>
        </div>
      ) : (
        <div className="account-wishlist-grid">
          {items.map((item) => {
            const title = isEs && item.title_es ? item.title_es : item.title;
            return (
              <article key={item.id} className="account-wishlist-card">
                <Link href={`${prefix}/shop/${item.id}`} className="account-wishlist-image">
                  {item.image ? (
                    <Image src={item.image} alt={title} fill sizes="180px" className="object-contain" unoptimized={item.image.startsWith('/assets/')} />
                  ) : (
                    <span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>
                  )}
                </Link>
                <div>
                  <Link href={`${prefix}/shop/${item.id}`}>{title}</Link>
                  <span>{item.price_mode === 'manual' ? (item.manual_price_label ?? (isEs ? 'Consultar precio' : 'Ask for price')) : (isEs ? 'Precio segun mercado' : 'Live market price')}</span>
                  <button type="button" onClick={() => remove(item.id)}>
                    {isEs ? 'Eliminar' : 'Remove'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PasswordChangeForm({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (password.length < 6) {
      setError(isEs ? 'Usa al menos 6 caracteres.' : 'Use at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError(isEs ? 'Las contrasenas no coinciden.' : 'Passwords do not match.');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword('');
    setConfirmPassword('');
    setOpen(false);
    setMessage(isEs ? 'Contrasena actualizada.' : 'Password updated.');
  }

  return (
    <div className="account-password-panel">
      <button type="button" className="outline-button text-sm account-arrow-button" onClick={() => setOpen((value) => !value)}>
        {isEs ? 'Cambiar contrasena' : 'Change Password'}
        <span className="material-symbols-outlined" aria-hidden="true">{open ? 'expand_less' : 'chevron_right'}</span>
      </button>
      {open && (
        <form onSubmit={handleSubmit}>
          <label>
            <span className="form-label">{isEs ? 'Nueva contrasena' : 'New Password'}</span>
            <input className="form-field w-full" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            <span className="form-label">{isEs ? 'Confirmar contrasena' : 'Confirm Password'}</span>
            <input className="form-field w-full" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          {error && <p className="account-form-error">{error}</p>}
          <button type="submit" disabled={saving} className="gold-button text-sm disabled:opacity-50">
            {saving ? (isEs ? 'Guardando...' : 'Saving...') : (isEs ? 'Guardar contrasena' : 'Save Password')}
          </button>
        </form>
      )}
      {message && <p className="account-form-success">{message}</p>}
    </div>
  );
}
