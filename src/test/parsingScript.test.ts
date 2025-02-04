import parsingScript from "../webview/parsingScript";

const mockFilePath = 'mockFile.ts';

const mockFile = `export function middleware(request: NextRequest) {
  // Apply authentication middleware
  const authResponse = authMiddleware(request);
  if (authResponse) return authResponse;

  // Apply locale redirection middleware
  const localeResponse = localeMiddleware(request);
  if (localeResponse) return localeResponse;

  // Apply custom headers middleware
  return customHeadersMiddleware();
}

export const config = {
  matcher: ['/protected/:path*', '/login', '/'],
};`;

const mockFinalObject = {
  name: 'mockFile.ts',
  children: [ {name: 'middleware', children: [], type: 'function'}],
  type: 'file',
  matcher: ["'/protected/:path*', '/login', '/'"]
};

jest.mock('fs', () => {
  return {
    readFileSync: jest.fn(() => mockFile)
  };
});

describe('Parsing script', () => {
  test('should return a finalObject in the correct format for D3', async () => {
    // const input = mockFilePath;
    // console.log('mockFilePath', input);
    const result = await parsingScript(mockFilePath);
    // console.log('result', result);
    expect(result).toEqual(mockFinalObject);
  });
});