import initSqlJs from "sql.js";
import JSZip from "jszip";

export interface AnkiCard {
  front: string;
  back: string;
  tags: string[];
  deckName: string;
  media: { [key: string]: Blob };
}

export interface AnkiImportResult {
  deckName: string;
  cards: AnkiCard[];
}

export async function parseAnkiApkg(file: File): Promise<AnkiImportResult[]> {
  const zip = await JSZip.loadAsync(file);
  
  // 1. Load SQL.js
  const SQL = await initSqlJs({
    locateFile: (file) => `https://unpkg.com/sql.js@1.14.1/dist/${file}`,
  });

  // 2. Find and load the SQLite database
  const ankiDbFile = zip.file("collection.anki21") || zip.file("collection.anki2");
  if (!ankiDbFile) {
    throw new Error("Not a valid Anki package: collection.anki2 not found");
  }

  const dbData = await ankiDbFile.async("uint8array");
  const db = new SQL.Database(dbData);

  // 3. Load media mapping
  const mediaFile = zip.file("media");
  let mediaMap: { [key: string]: string } = {};
  if (mediaFile) {
    const mediaContent = await mediaFile.async("text");
    mediaMap = JSON.parse(mediaContent);
  }

  // 4. Query decks
  const decksResult = db.exec("SELECT decks FROM col");
  const decksJson = JSON.parse(decksResult[0].values[0][0] as string);
  const deckIdToName: { [key: string]: string } = {};
  for (const id in decksJson) {
    deckIdToName[id] = decksJson[id].name;
  }

  // 5. Query models (note types)
  const modelsResult = db.exec("SELECT models FROM col");
  const modelsJson = JSON.parse(modelsResult[0].values[0][0] as string);

  // 6. Query notes and cards
  // Note: flds is the field content separated by \x1f
  // tags are stored in the notes table
  const query = `
    SELECT 
      c.did, 
      n.flds, 
      n.tags, 
      n.mid 
    FROM cards c 
    JOIN notes n ON c.nid = n.id
  `;
  const cardsResult = db.exec(query);

  if (cardsResult.length === 0) {
    return [];
  }

  const resultsByDeck: { [deckName: string]: AnkiCard[] } = {};

  for (const row of cardsResult[0].values) {
    const deckId = row[0] as number;
    const flds = row[1] as string;
    const tagsStr = row[2] as string;
    const mid = row[3] as number;

    const deckName = deckIdToName[deckId] || "Default";
    const tags = tagsStr.trim().split(" ").filter(t => t);
    
    const model = modelsJson[mid];
    const fields = flds.split("\u001f");
    
    // Simple mapping for now: 
    // Usually field 0 is front, field 1 is back. 
    // More complex mapping would involve looking at model.tmpls
    let front = fields[0] || "";
    let back = fields[1] || "";

    // If there are more fields, append them to back?
    if (fields.length > 2) {
      back += "\n\n" + fields.slice(2).join("\n");
    }

    // Extract media filenames from fields
    const mediaInCard: { [key: string]: Blob } = {};
    const imgRegex = /src=["']?([^"'>\s]+)["']?/g;
    let match;
    
    const processMedia = async (text: string) => {
      while ((match = imgRegex.exec(text)) !== null) {
        const filename = match[1];
        // Find the index in mediaMap
        const mediaIndex = Object.keys(mediaMap).find(key => mediaMap[key] === filename);
        if (mediaIndex && zip.file(mediaIndex)) {
          const blob = await zip.file(mediaIndex)!.async("blob");
          mediaInCard[filename] = blob;
        }
      }
    };

    await processMedia(front);
    await processMedia(back);

    const card: AnkiCard = {
      front,
      back,
      tags,
      deckName,
      media: mediaInCard,
    };

    if (!resultsByDeck[deckName]) {
      resultsByDeck[deckName] = [];
    }
    resultsByDeck[deckName].push(card);
  }

  db.close();

  return Object.entries(resultsByDeck).map(([deckName, cards]) => ({
    deckName,
    cards,
  }));
}
