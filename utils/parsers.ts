
import { Product } from '../types';

export const parseMetelOrCsv = (content: string): Product[] => {
  // Safety Guard: Check if content looks binary (e.g. PK header for Zip/XLSX or null bytes)
  if (content.startsWith('PK') || content.substring(0, 100).split('').filter(c => c.charCodeAt(0) < 32 && c.charCodeAt(0) !== 10 && c.charCodeAt(0) !== 13 && c.charCodeAt(0) !== 9).length > 10) {
      console.warn("Binary file detected in text parser. Aborting.");
      return [];
  }

  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 2);
  if (lines.length === 0) return [];

  // Detect Separator
  const firstLine = lines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const pipeCount = (firstLine.match(/\|/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let separator = ';'; // Default to semicolon
  if (tabCount >= 2) separator = '\t';
  else if (pipeCount >= 2) separator = '|';
  else if (semicolonCount >= 2) separator = ';';

  // Check if it looks like Fixed Width METEL (usually no separator and long lines)
  if (separator === ';' && semicolonCount < 1 && firstLine.length > 100) {
      return parseFixedWidth(lines);
  }

  return parseCustomCsv(lines, separator);
};

const parseCustomCsv = (lines: string[], separator: string): Product[] => {
    // STRICT USER MAPPING
    // 0: Sigla marchio (Brand)
    // 1: Codice prodotto produttore (Code)
    // 2: Codice EAN (EAN)
    // 3: Descrizione prodotto (Description)
    // 4: Quantità minima ordine (MinQty)
    // 5: Prezzo al pubblico (Price)

    const products: Product[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length < 2) continue;
        
        const cols = line.split(separator).map(c => c.trim());
        
        // Skip Header Row
        // Check if the first column looks like a header name
        const c0 = cols[0].toLowerCase();
        const c1 = cols[1]?.toLowerCase() || '';
        if (c0.includes('sigla') || c0.includes('marchio') || c0 === 'brand' || c1.includes('codice')) {
            continue;
        }

        // We need at least the first 2 columns (Brand, Code) to be useful
        if (cols.length < 2) continue;

        const rawBrand = cols[0];
        const rawCode = cols[1];
        const rawEan = cols[2] || '';
        const rawDesc = cols[3] || '';
        const rawMinQty = cols[4] || '1';
        const rawPrice = cols[5] || '0';

        // 1. Clean Price
        let priceStr = rawPrice.replace(/[€$£]/g, '').trim();
        let price = 0;

        // Italian format logic: "1.200,50" -> 1200.50
        // English format logic: "1,200.50" -> 1200.50
        // Excel often exports raw numbers like "1200.5", but sometimes formatted strings.
        
        if (priceStr.includes(',') && priceStr.includes('.')) {
            // Complex case (both separators). Assume last one is decimal.
            const lastComma = priceStr.lastIndexOf(',');
            const lastDot = priceStr.lastIndexOf('.');
            
            if (lastComma > lastDot) {
                // IT style: 1.200,50
                priceStr = priceStr.replace(/\./g, '').replace(',', '.');
            } else {
                // US style: 1,200.50
                priceStr = priceStr.replace(/,/g, '');
            }
        } else if (priceStr.includes(',')) {
            // Only comma? Assume it's decimal separator (European standard for manual input/files)
            priceStr = priceStr.replace(',', '.');
        }
        // If only dot, assumed standard decimal.

        price = parseFloat(priceStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(price)) price = 0;

        // 2. Clean MinQty
        let minQty = parseFloat(rawMinQty.replace(',', '.').replace(/[^0-9.]/g, ''));
        if (isNaN(minQty)) minQty = 1;

        // 3. Clean EAN (alphanumeric, just in case)
        const ean = rawEan.replace(/[^0-9a-zA-Z]/g, '');

        // 4. Fallback Description
        let description = rawDesc;
        if (!description || description.length < 2) {
             description = `${rawBrand} - Art. ${rawCode}`;
        }

        if (rawCode.length > 0) {
             products.push({
                code: rawCode,
                brand: rawBrand,
                ean: ean || rawCode, // Fallback EAN to code if missing
                description: description,
                minQty: minQty,
                price: price,
                unit: 'PZ'
            });
        }
    }
    
    return products;
};

const parseFixedWidth = (lines: string[]): Product[] => {
    // Standard METEL Logic (Fallback)
    return lines.map(line => {
        if (line.length < 50) return null;

        const brand = line.substring(0, 3).trim(); 
        const code = line.substring(4, 20).trim();
        const ean = line.substring(20, 33).trim();
        const desc = line.substring(33, 76).trim();

        // Price in METEL is trickier without a defined position in this snippet context,
        // but typically it's towards the end. We'll use a heuristic.
        const priceMatches = line.matchAll(/([0-9]{1,6}[.,][0-9]{2})/g);
        let price = 0;
        let lastMatch = null;
        for (const m of priceMatches) {
             if (m[0].replace(/[^0-9]/g, '') !== ean) {
                lastMatch = m[0];
            }
        }
        if (lastMatch) {
            price = parseFloat(lastMatch.replace(',', '.').replace(/[^0-9.]/g, ''));
        }

        return {
            ean: ean || code,
            code: code,
            description: desc || `${brand} ${code}`,
            price: price || 0,
            brand: brand || 'METEL',
            unit: 'PZ',
            minQty: 1
        };
    }).filter(p => p !== null) as Product[];
};
