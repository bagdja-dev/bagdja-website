interface ProductPriceProps {
  priceLabel: string;
  quotable?: boolean;
}

export function ProductPrice({ priceLabel, quotable = false }: ProductPriceProps) {
  const label = typeof priceLabel === 'string' ? priceLabel.trim() : '';
  if (!label) return null;

  return (
    <span className="inline-flex flex-col">
      {quotable ? (
        <span className="text-[0.65em] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Mulai dari
        </span>
      ) : null}
      <span>{label}</span>
    </span>
  );
}
