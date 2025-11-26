import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
// Note: In a real production app, ensure the key is restricted or proxied.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseUnstructuredData = async (rawText: string): Promise<{ products: any[] }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analizza questo frammento di file di listino (potrebbe essere METEL o CSV malformato). 
      Estrai una lista di prodotti con i campi: ean (o codice a barre), code (codice articolo), description, price (numero), brand.
      Se non trovi un campo, lascialo vuoto o 0.
      
      Dati:
      ${rawText.substring(0, 3000)}`, // Limit input size for demo
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