export const QUICK_FILL_PROMPT_STORAGE_KEY = 'naples-admin-quick-fill-ai-prompt';

export const QUICK_FILL_BRAND_RULES_MARKER = 'Brand detection rules:';
export const QUICK_FILL_WATCH_RULES_MARKER = 'Watch item type rules:';
export const QUICK_FILL_PRODUCT_HIERARCHY_RULES_MARKER = 'Product hierarchy rules:';

export const QUICK_FILL_BRAND_RULES_ADDENDUM = `${QUICK_FILL_BRAND_RULES_MARKER}

* Always scan the user's raw item description, proposed title, hallmarks, maker marks, signature wording, and any phrase such as "by", "signed", "marked", "maker", "designer", "brand", or "manufacturer" for a brand/designer/maker name.
* If a known brand, designer, maker, or manufacturer appears anywhere in the input, output a separate Brand line, even if that same name is also included in Title English or Title Spanish.
* The Brand value must be only the brand/designer/maker/manufacturer name, not the metal, style, item type, weight, or descriptive title.
* Examples: "David Yurman sterling bangle" -> Brand:David Yurman. "Tiffany & Co. 18K ring" -> Brand:Tiffany & Co. "Cartier love bracelet" -> Brand:Cartier. "Van Cleef & Arpels pendant" -> Brand:Van Cleef & Arpels.
* Do not use origin words as Brand. Italian, Italy, French, Mexico, and similar origin/manufacture words are not Brand unless the input clearly names an actual maker/brand.
* If the input has no confident brand/designer/maker/manufacturer, omit Brand.`;

export const QUICK_FILL_WATCH_RULES_ADDENDUM = `${QUICK_FILL_WATCH_RULES_MARKER}

* If the item is a watch, wristwatch, or timepiece, output Product Type:Watch.
* Do not use Link Type for watches. Link Type is only for necklace or bracelet link/style families.
* Do not infer Product Type:Bracelet from a watch bracelet/strap/band. A watch with a bracelet or strap is still Product Type:Watch.
* Include Brand for watch makers when known, such as Brand:Rolex, Brand:Patek Philippe, Brand:Omega, Brand:Cartier, Brand:Tag Heuer, or Brand:Seiko.
* Use Description English/Notes (EN) for watch-specific details such as model, reference number, movement, case size, bracelet/strap material, serial markings, condition, box/papers, and service notes.
* Omit Length and Size for watches unless the user clearly provides a wearable wrist size or another measurement that belongs in the existing Length/Size field.`;

export const QUICK_FILL_PRODUCT_HIERARCHY_RULES_ADDENDUM = `${QUICK_FILL_PRODUCT_HIERARCHY_RULES_MARKER}

* Use Product Type as the primary item classification.
* Product Type options include Necklace, Bracelet, Ring, Pendant, Charm, Earrings, Brooch, Cufflinks, Watch, Coin, Bullion, Silverware / Sterling, or Other.
* If the item form is clear but is not listed, output a concise new Product Type instead of forcing Other.
* Use Metal Type as the material classification.
* Metal Type options are Gold, Silver, Platinum, Palladium, Mixed Metal, Non-Metal, or Other.
* Use Metal Color as the color/subtype, such as Yellow Gold, White Gold, Rose Gold, Tricolor Gold, Bicolor Gold, Silver, Vermeil, or Platinum.
* Prefer Product Type over the older Jewelry Type label. The form may still accept Jewelry Type for compatibility, but Product Type is the desired label going forward.
* Prefer Metal Type over the older Category label. Category remains a Gold/Silver compatibility field, but Metal Type is the desired label going forward.`;

export const DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT = `Format my item description for a product Quick Fill form. Return one fenced code block containing only labeled Field:Value lines, one per line, so I can copy the entire block quickly. Do not put any explanation before or after the code block. Do not use bullets, markdown headings, commentary, or extra text outside the code block.

Every output line must target a specific field label from the allowed list. Do not output unlabeled CSV, unlabeled values, or any line that is not aimed at a known field.
The Quick Fill parser expects labeled field-targeted lines. Use Field:Value exactly, with one product field per line.

Use only these field labels when known:
Title English, Title Spanish, Product Type, Brand, Metal Type, Metal Color, Status, Gender, Location, Link Type, Length, Size, Price Mode, Purity, Weight, Multiplier, Asking Price, Description English, Description Spanish, Notes (EN).

Use Product Type as Necklace, Bracelet, Ring, Pendant, Charm, Earrings, Brooch, Cufflinks, Watch, Coin, Bullion, Silverware / Sterling, or another concise item form when needed.

Use Metal Type as Gold, Silver, Platinum, Palladium, Mixed Metal, Non-Metal, or Other.

Use Metal Color as Yellow Gold, White Gold, Rose Gold, Tricolor Gold, Bicolor Gold, Silver, Vermeil, or Platinum.
Metal Color helps determine the legacy pricing metal when it is known:
Yellow Gold, White Gold, Rose Gold, Tricolor Gold, and Bicolor Gold are Gold.
Silver and Vermeil are Silver.
If you include both Metal Type and Metal Color, make sure they agree.
Bicolor Gold is a gold metal color, but the shop treats it as a crossover item that appears under both broad Gold and Silver filters.

${QUICK_FILL_PRODUCT_HIERARCHY_RULES_ADDENDUM}

Use Status as Draft, Available, Reserved, Pending Payment, Sold, or Archived.

Use Price Mode as Manual or Spot.

Use Brand for a known maker, designer, brand, or manufacturer name, such as Brand:David Yurman. Omit Brand when it is not confidently known.
Brand is free text; do not invent a normalized brand list.

${QUICK_FILL_BRAND_RULES_ADDENDUM}

Title rules:

* Do not include the item's gram weight in Title English or Title Spanish when Weight is being output as its own field.
* Titles should describe the item, metal color, purity, style, origin/maker when relevant, and item type, but leave weight for the Weight field/specifications.

Use Product Type for the broad item form only.
Use Product Type:Watch for any watch, wristwatch, or timepiece.

${QUICK_FILL_WATCH_RULES_ADDENDUM}

Use Link Type only when Product Type is Necklace or Bracelet.
Use Link Type for the chain/link/style family only: Cuban link, Figaro link, Rope chain, Anchor / Gucci link, Oval link, Byzantine link, Box link, or another clearly stated link/style family.
Keep Product Type and Link Type completely separate. For example, output Product Type:Bracelet and Link Type:Cuban link, not Link Type:Cuban link bracelet.
Necklace link types and bracelet link types are scoped by their Product Type; do not rely on Link Type alone to imply whether an item is a necklace or bracelet.
If the link/style family is clearly stated but not in the common examples above, output it as the Link Type value anyway; it will be entered directly into the field, not added as a permanent dropdown choice.

Use Length for necklaces and bracelets, such as Length:22 in or Length:7.5 in.
Use Size for rings, such as Size:7 or Size:6.5. Do not write ring sizes as inches.
Length and Size are direct field values. Use the measured value exactly and do not invent a permanent option list.

Important terminology rules:

* The word "Italian" always refers to the maker, origin, or manufacture of the overall piece and should be used only in titles, descriptions, or notes describing the item as a whole.
* The word "Cuban" always refers to the chain/link style and should be represented as Link Type:Cuban link when applicable for a necklace or bracelet.
* Never combine or place "Italian" and "Cuban" directly next to each other in a title or description (for example, avoid "Italian Cuban Link Bracelet"). Instead use wording such as "Italian 14K Gold Bracelet" and describe the Cuban link style separately in the description or Link Type field.
* Apply the same separation rule to all other chain styles (Byzantine, Figaro, Rope, etc.) when the item is described as Italian-made.

Notes (EN) rules:

* Notes (EN) is the English buyer-facing public note. Its Spanish counterpart, Notes (ES), is generated automatically by translation on save, so do not output a Spanish notes field here.
* Do not repeat information in Notes (EN) that is already clearly covered in Description English or Description Spanish.
* Notes (EN) should contain concise buyer-safe facts that do not already fit naturally in the description, such as extra measurements, markings, clasp details, included extras, special condition notes, or service notes.

Omit any field you cannot confidently determine.

Preserve useful measurements, markings, dimensions, clasp types, condition notes, and manufacturing details in Description English and Notes (EN) as appropriate.`;

export function ensureQuickFillPromptHasCurrentBrandRules(prompt: string): string {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT;
  const addenda: string[] = [];
  if (!trimmedPrompt.includes(QUICK_FILL_BRAND_RULES_MARKER)) addenda.push(QUICK_FILL_BRAND_RULES_ADDENDUM);
  if (!trimmedPrompt.includes(QUICK_FILL_WATCH_RULES_MARKER)) addenda.push(QUICK_FILL_WATCH_RULES_ADDENDUM);
  if (!trimmedPrompt.includes(QUICK_FILL_PRODUCT_HIERARCHY_RULES_MARKER)) addenda.push(QUICK_FILL_PRODUCT_HIERARCHY_RULES_ADDENDUM);
  return [trimmedPrompt, ...addenda].join('\n\n');
}
