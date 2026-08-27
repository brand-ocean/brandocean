import { type Infer, v } from "convex/values";

// BTW-categorie op journaalregels (en als default op rekeningen/facturen).
// "geen" = buiten de BTW-sfeer (loon, bank, kapitaal, interne overboekingen).
export const vatCategoryV = v.union(
	v.literal("hoog"), // 21%
	v.literal("laag"), // 9%
	v.literal("nul"), // 0% binnenland/export
	v.literal("verlegd"), // BTW verlegd
	v.literal("eu_dienst"), // ICP-diensten (rubriek 3b)
	v.literal("prive"), // priveegebruik (rubriek 1d)
	v.literal("geen"),
);
export type VatCategory = Infer<typeof vatCategoryV>;

export const entryTypeV = v.union(
	v.literal("opening"),
	v.literal("sales"),
	v.literal("sales_payment"),
	v.literal("purchase"),
	v.literal("bank"),
	v.literal("memoriaal"),
	v.literal("payroll"),
	v.literal("vat_close"),
	v.literal("reversal"),
);
export type EntryType = Infer<typeof entryTypeV>;

export const accountTypeV = v.union(
	v.literal("asset"),
	v.literal("liability"),
	v.literal("equity"),
	v.literal("revenue"),
	v.literal("expense"),
);
export type AccountType = Infer<typeof accountTypeV>;
