import Link from 'next/link';

export default function FormPrivacyNotice({
  locale,
  className = '',
  color = 'var(--color-on-surface-variant)',
  linkColor = 'var(--color-primary)',
}: {
  locale: string;
  className?: string;
  color?: string;
  linkColor?: string;
}) {
  const isEs = locale === 'es';
  const prefix = isEs ? '/es' : '';

  return (
    <p className={`text-xs leading-relaxed ${className}`} style={{ color }}>
      {isEs
        ? 'Al enviar este formulario, acepta que usemos su información para responder a su consulta y proporcionar los servicios solicitados.'
        : 'By submitting this form, you agree that we may use your information to respond to your inquiry and provide requested services.'}{' '}
      <Link href={`${prefix}/privacy`} className="font-bold underline underline-offset-2" style={{ color: linkColor }}>
        {isEs ? 'Política de Privacidad' : 'Privacy Policy'}
      </Link>
      .
    </p>
  );
}
