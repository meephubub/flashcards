const { chromium } = require("playwright");

const url = process.argv[2];
if (!url) {
    console.error("Usage: node scrape-quizlet.js <quizlet-url>");
    process.exit(1);
}

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "en-GB"
    });

    const page = await context.newPage();

    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Wait for flashcards container
        await page.waitForSelector('[aria-label="Flashcards"]', { timeout: 60000 });

        // 🔁 Scroll to force Quizlet to render all cards
        await page.evaluate(async () => {
            const scrollContainer = document.scrollingElement;
            let lastHeight = 0;

            for (let i = 0; i < 20; i++) {
                scrollContainer.scrollBy(0, window.innerHeight);
                await new Promise(r => setTimeout(r, 500));

                const newHeight = scrollContainer.scrollHeight;
                if (newHeight === lastHeight) break;
                lastHeight = newHeight;
            }
        });

        // ✅ Extract visible card text
        const cards = await page.evaluate(() => {
            const results = [];

            // Each card
            const cardNodes = document.querySelectorAll(
                '[aria-label="Flashcards"] [role="listitem"]'
            );

            cardNodes.forEach(card => {
                const texts = card.querySelectorAll("span");

                if (texts.length >= 2) {
                    const term = texts[0].innerText.trim();
                    const definition = texts[texts.length - 1].innerText.trim();

                    if (term && definition && term !== definition) {
                        results.push({ term, definition });
                    }
                }
            });

            return results;
        });

        console.log(JSON.stringify(cards, null, 2));
        console.error(`✔ Scraped ${cards.length} cards`);
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await browser.close();
    }
})();
