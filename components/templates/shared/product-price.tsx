interface ProductPriceProps {
  priceLabel: string;
  quotable?: boolean;
}

export function ProductPrice({ priceLabel, quotable = false }: ProductPriceProps) {
  return (
    <span className="inline-flex flex-col">
      {quotable && priceLabel.trim() ? (
        <span className="text-[0.65em] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Mulai dari
        </span>
      ) : null}
      <span>{priceLabel}</span>
    </span>
  );
}
