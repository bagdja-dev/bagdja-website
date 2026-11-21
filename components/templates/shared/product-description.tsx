import type { ReactNode } from 'react';

export function ProductDescription({
  description,
  descriptionHtml,
  className,
  children,
}: {
  description?: string;
  descriptionHtml?: string;
  className?: string;
  children?: ReactNode;
}) {
  if (descriptionHtml) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: descriptionHtml }}
      />
    );
  }

  if (description) {
    return <p className={className}>{description}</p>;
  }

  return children ? <p className={className}>{children}</p> : null;
}
