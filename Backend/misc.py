import asyncio
from crawl4ai import AsyncWebCrawler

async def main():
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun("https://docs.crawl4ai.com/core/quickstart/")
        print(result.markdown[:900])  # Print first 300 chars

if __name__ == "__main__":
    asyncio.run(main())
