import type { Metadata } from 'next';
import { getAccountMetadata } from '@/lib/account-metadata';

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  return getAccountMetadata('sign-up', locale);
}

export default function SignUpLayout({ children }: Props) {
  return children;
}
