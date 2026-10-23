const mockSearch = jest.fn();

jest.mock(
  '@azure/search-documents',
  () => ({
    AzureKeyCredential: jest.fn(),
    SearchClient: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '@librechat/agents/langchain/tools',
  () => ({
    Tool: class {},
  }),
  { virtual: true },
);

jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: { error: jest.fn() },
  }),
  { virtual: true },
);

const { SearchClient } = require('@azure/search-documents');
const { logger } = require('@librechat/data-schemas');
const AzureAISearch = require('../AzureAISearch');

const baseFields = {
  AZURE_AI_SEARCH_SERVICE_ENDPOINT: 'https://example.search.windows.net',
  AZURE_AI_SEARCH_INDEX_NAME: 'index',
  AZURE_AI_SEARCH_API_KEY: 'key',
};

/** Builds an async iterable of search results, mirroring SearchClient.search's shape. */
const searchResponse = (documents) => ({
  results: (async function* () {
    for (const document of documents) {
      yield { document };
    }
  })(),
});

describe('AzureAISearch vector inputs', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env.AZURE_AI_SEARCH_VECTOR_FIELDS;
    delete process.env.AZURE_AI_SEARCH_SEARCH_OPTION_TOP;
    delete process.env.AZURE_AI_SEARCH_SEARCH_OPTION_QUERY_TYPE;
    delete process.env.AZURE_AI_SEARCH_SEARCH_OPTION_SELECT;
    mockSearch.mockReset();
    SearchClient.mockImplementation(() => ({ search: mockSearch }));
    mockSearch.mockResolvedValue(searchResponse([{ id: 1 }]));
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  const build = (overrides = {}) => new AzureAISearch({ ...baseFields, ...overrides });

  describe('construction and field parsing', () => {
    it('parses comma-separated vector fields, trimming whitespace and dropping empties', () => {
      const tool = build({ AZURE_AI_SEARCH_VECTOR_FIELDS: ' a , b,,  c ' });
      expect(tool.vectorFields).toEqual(['a', 'b', 'c']);
    });

    it('defaults vectorFields to an empty array when unset', () => {
      const tool = build();
      expect(tool.vectorFields).toEqual([]);
    });

    it('reads AZURE_AI_SEARCH_VECTOR_FIELDS from the environment when not passed', () => {
      process.env.AZURE_AI_SEARCH_VECTOR_FIELDS = 'contentVector';
      const tool = build();
      expect(tool.vectorFields).toEqual(['contentVector']);
    });

    it('defaults top to 5 and queryType to simple', () => {
      const tool = build();
      expect(tool.top).toBe(AzureAISearch.DEFAULT_TOP);
      expect(tool.queryType).toBe(AzureAISearch.DEFAULT_QUERY_TYPE);
    });
  });

  describe('request building', () => {
    it('sends only the keyword query when no filter or vector text is given', async () => {
      const tool = build();
      await tool._call({ query: 'hello' });

      expect(mockSearch).toHaveBeenCalledWith('hello', {
        queryType: 'simple',
        top: 5,
      });
    });

    it('passes the OData filter through as-is', async () => {
      const tool = build();
      const filter = "category eq 'docs' and year ge 2024";
      await tool._call({ query: 'hello', filter });

      expect(mockSearch.mock.calls[0][1].filter).toBe(filter);
    });

    it('omits the filter key when filter is empty', async () => {
      const tool = build();
      await tool._call({ query: 'hello', filter: '' });

      expect(mockSearch.mock.calls[0][1]).not.toHaveProperty('filter');
    });

    it('builds a text vector query over every configured vector field', async () => {
      const tool = build({ AZURE_AI_SEARCH_VECTOR_FIELDS: 'title_vec, body_vec' });
      await tool._call({ query: 'hello', vectorQueryText: 'semantic hello' });

      expect(mockSearch.mock.calls[0][1].vectorSearchOptions).toEqual({
        queries: [{ kind: 'text', text: 'semantic hello', fields: ['title_vec', 'body_vec'] }],
      });
    });

    it('converts a string top from config to a number', async () => {
      const tool = build({ AZURE_AI_SEARCH_SEARCH_OPTION_TOP: '12' });
      await tool._call({ query: 'hello' });

      expect(mockSearch.mock.calls[0][1].top).toBe(12);
    });

    it('splits select config into a field list', async () => {
      const tool = build({ AZURE_AI_SEARCH_SEARCH_OPTION_SELECT: 'id,title' });
      await tool._call({ query: 'hello' });

      expect(mockSearch.mock.calls[0][1].select).toEqual(['id', 'title']);
    });

    it('returns serialized documents from the search results', async () => {
      mockSearch.mockResolvedValue(searchResponse([{ id: 1 }, { id: 2 }]));
      const tool = build();
      const result = await tool._call({ query: 'hello' });

      expect(JSON.parse(result)).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('validation and edge cases', () => {
    it('throws on construction when the service endpoint is missing', () => {
      expect(() => build({ AZURE_AI_SEARCH_SERVICE_ENDPOINT: '' })).toThrow(
        'Missing AZURE_AI_SEARCH_SERVICE_ENDPOINT',
      );
    });

    it('throws on construction when the index name is missing', () => {
      expect(() => build({ AZURE_AI_SEARCH_INDEX_NAME: '' })).toThrow(
        'Missing AZURE_AI_SEARCH_SERVICE_ENDPOINT, AZURE_AI_SEARCH_INDEX_NAME',
      );
    });

    it('throws on construction when the API key is missing', () => {
      expect(() => build({ AZURE_AI_SEARCH_API_KEY: '' })).toThrow(
        'Missing AZURE_AI_SEARCH_SERVICE_ENDPOINT, AZURE_AI_SEARCH_INDEX_NAME, or AZURE_AI_SEARCH_API_KEY',
      );
    });

    it('treats an empty query text as a plain search call without throwing', async () => {
      const tool = build();
      const result = await tool._call({ query: '' });

      expect(mockSearch).toHaveBeenCalledWith('', expect.any(Object));
      expect(JSON.parse(result)).toEqual([{ id: 1 }]);
    });

    it('ignores an empty vectorQueryText and does not attach vector options', async () => {
      const tool = build();
      await tool._call({ query: 'hello', vectorQueryText: '' });

      expect(mockSearch.mock.calls[0][1]).not.toHaveProperty('vectorSearchOptions');
    });

    it('returns an error string instead of sending a vector query when no vector fields are configured', async () => {
      const tool = build();
      const result = await tool._call({ query: 'hello', vectorQueryText: 'semantic' });

      expect(mockSearch).not.toHaveBeenCalled();
      expect(result).toBe('There was an error with Azure AI Search.');
      expect(logger.error).toHaveBeenCalledWith(
        'Azure AI Search request failed',
        expect.objectContaining({
          message:
            'AZURE_AI_SEARCH_VECTOR_FIELDS must be configured when using vector search queries.',
        }),
      );
    });

    it('treats a whitespace-only vector fields value as unconfigured', async () => {
      const tool = build({ AZURE_AI_SEARCH_VECTOR_FIELDS: ' , ,  ' });
      const result = await tool._call({ query: 'hello', vectorQueryText: 'semantic' });

      expect(mockSearch).not.toHaveBeenCalled();
      expect(result).toBe('There was an error with Azure AI Search.');
    });

    it('passes a filter string verbatim to the client without interpreting it', async () => {
      const tool = build();
      const hostile = "x eq 'a' or 1 eq 1";
      await tool._call({ query: 'hello', filter: hostile });

      expect(mockSearch.mock.calls[0][1].filter).toBe(hostile);
    });
  });

  describe('error propagation', () => {
    it('returns a generic error string and logs when the search client rejects', async () => {
      mockSearch.mockRejectedValue(new Error('503 service unavailable'));
      const tool = build({ AZURE_AI_SEARCH_VECTOR_FIELDS: 'vec' });
      const result = await tool._call({ query: 'hello', vectorQueryText: 'semantic' });

      expect(result).toBe('There was an error with Azure AI Search.');
      expect(logger.error).toHaveBeenCalledWith(
        'Azure AI Search request failed',
        expect.any(Error),
      );
    });

    it('does not throw from _call when iterating results fails', async () => {
      mockSearch.mockResolvedValue({
        results: {
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.reject(new Error('stream broke')),
          }),
        },
      });
      const tool = build();
      await expect(tool._call({ query: 'hello' })).resolves.toBe(
        'There was an error with Azure AI Search.',
      );
    });
  });
});
