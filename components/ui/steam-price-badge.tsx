import { formatCurrency } from "@/lib/utils";

type Props = {
  priceCents: number;
  originalPriceCents?: number;
  discountPercent?: number;
  currency: string;
  size?: "xs" | "sm";
};

export function SteamPriceBadge({ priceCents, originalPriceCents, discountPercent, currency, size = "sm" }: Props) {
  const hasDiscount = (discountPercent ?? 0) > 0 && originalPriceCents && originalPriceCents > priceCents;
  const isXs = size === "xs";

  if (hasDiscount) {
    return (
      <div className="flex items-stretch rounded overflow-hidden leading-none">
        {/* Discount % — olive green + lime bold */}
        <div className={`flex items-center justify-center bg-[#4c6b22] font-black text-[#beee11] ${isXs ? "px-2 py-1.5 text-[12px]" : "px-3 py-2 text-[16px]"}`}>
          -{discountPercent}%
        </div>
        {/* Prices — slate bg, struck original + lime current */}
        <div className={`flex flex-col items-end justify-center bg-[#2a3f5a] ${isXs ? "px-2 py-1 gap-0.5" : "px-3 py-1.5 gap-0.5"}`}>
          <span className={`text-[#8ba5bd] line-through leading-none ${isXs ? "text-[8px]" : "text-[10px]"}`}>
            {formatCurrency(originalPriceCents!, currency)}
          </span>
          <span className={`font-bold text-[#beee11] leading-none ${isXs ? "text-[12px]" : "text-[15px]"}`}>
            {formatCurrency(priceCents, currency)}
          </span>
        </div>
      </div>
    );
  }

  /* No discount — still needs a visible container */
  return (
    <div className={`rounded bg-[#2a3f5a] font-bold text-[#c7d5e0] leading-none ${isXs ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-[14px]"}`}>
      {formatCurrency(priceCents, currency)}
    </div>
  );
}
