import type { CSSProperties, ElementType, ReactNode } from 'react';

type MaxWidth = 'narrow' | 'content' | 'wide' | 'full';

const maxWidthClass: Record<MaxWidth, string> = {
  narrow: 'max-w-4xl',
  content: 'max-w-6xl ultrawide-page',
  wide: 'max-w-7xl ultrawide-page-wide',
  full: 'max-w-[2400px] ultrawide-page-wide',
};

interface BoxProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  id?: string;
  style?: CSSProperties;
  'aria-labelledby'?: string;
}

interface ContainerProps extends BoxProps {
  max?: MaxWidth;
}

export function PageContainer({ as: Component = 'div', max = 'wide', className = '', children, ...props }: ContainerProps) {
  return (
    <Component className={`responsive-container ${maxWidthClass[max]} ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function Section({ as: Component = 'section', className = '', children, ...props }: BoxProps) {
  return (
    <Component className={`responsive-section ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function Stack({ as: Component = 'div', className = '', children, ...props }: BoxProps) {
  return (
    <Component className={`responsive-stack ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function ResponsiveGrid({ as: Component = 'div', className = '', children, ...props }: BoxProps) {
  return (
    <Component className={`responsive-grid ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function CardGrid({ as: Component = 'div', className = '', children, ...props }: BoxProps) {
  return (
    <Component className={`responsive-card-grid ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function FormGrid({ as: Component = 'div', className = '', children, ...props }: BoxProps) {
  return (
    <Component className={`responsive-form-grid ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function HeroSection({ as: Component = 'section', className = '', children, ...props }: BoxProps) {
  return (
    <Component className={`responsive-hero ${className}`} {...props}>
      {children}
    </Component>
  );
}
