import FirecrawlApp from '@mendable/firecrawl-js';
import { RealtimeClient } from '@openai/realtime-api-beta';

interface ToolCallbacks {
  onMemorySet: (key: string, value: string) => void;
  onWeatherFetch: (lat: number, lng: number, location: string, temperature: any, wind_speed: any) => void;
  onScreenshotSet: (screenshot: string) => void;
}

export const registerRealtimeTools = (
  client: RealtimeClient,
  callbacks: ToolCallbacks
) => {
  client.addTool(
    {
      name: 'set_memory',
      description: 'Saves important data about the user into memory.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description:
              'The key of the memory value. Always use lowercase and underscores, no other characters.',
          },
          value: {
            type: 'string',
            description: 'Value can be anything represented as a string',
          },
        },
        required: ['key', 'value'],
      },
    },
    async ({ key, value }: { [key: string]: any }) => {
      callbacks.onMemorySet(key, value);
      return { ok: true };
    }
  );

  client.addTool(
    {
      name: 'get_weather',
      description:
        'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
      parameters: {
        type: 'object',
        properties: {
          lat: {
            type: 'number',
            description: 'Latitude',
          },
          lng: {
            type: 'number',
            description: 'Longitude',
          },
          location: {
            type: 'string',
            description: 'Name of the location',
          },
        },
        required: ['lat', 'lng', 'location'],
      },
    },
    async ({ lat, lng, location }: { [key: string]: any }) => {
      const result = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`
      );
      const json = await result.json();
      const temperature = {
        value: json.current.temperature_2m as number,
        units: json.current_units.temperature_2m as string,
      };
      const wind_speed = {
        value: json.current.wind_speed_10m as number,
        units: json.current_units.wind_speed_10m as string,
      };
      callbacks.onWeatherFetch(lat, lng, location, temperature, wind_speed);
      return json;
    }
  );

  client.addTool(
    {
      name: 'scrape_data',
      description: 'Goes to or scrapes data from a given URL using @Firecrawl.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to scrape data from',
          },
        },
        required: ['url'],
      },
    },
    async ({ url }: { [key: string]: any }) => {
      const firecrawl = new FirecrawlApp({
        apiKey: 'fc-',
      });
      const data = await firecrawl.scrapeUrl(url, {
        formats: ['markdown', 'screenshot'],
      });
      if (!data.success) {
        return 'Failed to scrape data from the given URL.';
      }
      callbacks.onScreenshotSet(data.screenshot ?? '');
      return data.markdown;
    }
  );

  client.addTool(
    {
      name: 'map_website',
      description:
        'Go to website and search for pages with a specific keyword.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to map',
          },
          search: {
            type: 'string',
            description: 'Keywords to search for (2-3 max)',
          },
        },
        required: ['url', 'search'],
      },
    },
    async ({ url, search }: { [key: string]: any }) => {
      const firecrawl = new FirecrawlApp({
        apiKey: 'fc-',
      });

      const map_data = await firecrawl.mapUrl(url, { search: search });
      if (!map_data.success) {
        return 'Failed to map data from the given URL.';
      }

      const top_link = map_data.links?.[0];
      if (!top_link) {
        return 'No links found for the given search criteria.';
      }

      const scrape_data = await firecrawl.scrapeUrl(top_link, {
        formats: ['markdown', 'screenshot'],
      });
      if (!scrape_data.success) {
        return 'Failed to scrape data from the top link.';
      }

      callbacks.onScreenshotSet(scrape_data.screenshot ?? '');
      return scrape_data.markdown;
    }
  );
};
