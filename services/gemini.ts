import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini using Vite's standard env variable access with safety check
// We cast to any to allow safe access if import.meta or env is somehow undefined in the current context
const apiKey = (import.meta as any)?.env?.VITE_API_KEY || '';

// Fail gracefully if key is missing (prevents immediate crash, logs error instead)
const ai = new GoogleGenAI({ apiKey: apiKey || 'MISSING_KEY' });

export const parseUnstructuredData = async (rawText: string): Promise<{ products: any[] }> => {
  if (!apiKey || apiKey === 'MISSING_KEY') {
      console.error("API Key mancante. Assicurati di aver configurato VITE_API_KEY nel file .env");
      return { products: [] };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analizza questo frammento di file di listino (potrebbe essere METEL o CSV malformato). 
      Estrai una lista di prodotti con i campi: ean (o codice a barre), code (codice articolo), description, price (numero), brand.
      Se non trovi un campo, lascialo vuoto o 0.
      
      Dati:
      ${rawText.substring(0, 3000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  ean: { type: Type.STRING },
                  code: { type: Type.STRING },
                  description: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  brand: { type: Type.STRING },
                }
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return { products: [] };
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini parsing error:", error);
    return { products: [] };
  }
};

export const identifyProductByCode = async (code: string): Promise<{ description: string, brand: string, priceEstimate: number }> => {
  if (!apiKey || apiKey === 'MISSING_KEY') return { description: "Chiave API mancante", brand: "Errore", priceEstimate: 0 };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Ho un codice a barre o codice articolo: "${code}". 
      Ipotizza di che prodotto elettrico/industriale si tratta. 
      Restituisci una breve descrizione, un brand probabile e un prezzo stimato in euro.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            brand: { type: Type.STRING },
            priceEstimate: { type: Type.NUMBER },
          }
        }
      }
    });

     const jsonText = response.text;
    if (!jsonText) throw new Error("No response");
    return JSON.parse(jsonText);
  } catch (error) {
    return { description: "Prodotto sconosciuto", brand: "Generico", priceEstimate: 0 };
  }
};