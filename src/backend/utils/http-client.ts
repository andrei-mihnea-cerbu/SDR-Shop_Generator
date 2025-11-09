import { fetch } from 'undici';

export interface HttpRequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string | number>;
  signal?: AbortSignal;
}

export interface HttpResponse<T> {
  status: number;
  body: T;
}

export class HttpClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private defaultParams: Record<string, string | number>;

  constructor(
    baseUrl: string,
    headers: Record<string, string> = {},
    defaultParams: Record<string, string | number> = {}
  ) {
    if (!baseUrl) {
      throw new Error('Base URL is required');
    }

    this.baseUrl = baseUrl;
    this.headers = headers;
    this.defaultParams = defaultParams;
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number>
  ): string {
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(
      `${this.baseUrl.replace(/\/+$/, '')}/${normalizedPath}`
    );

    const finalParams = { ...this.defaultParams, ...params };
    for (const [key, value] of Object.entries(finalParams)) {
      url.searchParams.append(key, String(value));
    }

    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    data?: unknown,
    config: HttpRequestConfig = {},
    fallbackMessage = 'Request failed'
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrl(path, config.params);

    const headers = {
      ...this.headers,
      ...config.headers,
    };

    const body = data !== undefined ? JSON.stringify(data) : undefined;
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: config.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const responseBody = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      return {
        status: response.status,
        body: responseBody as T,
      };
    } catch (err: any) {
      return {
        status: 500,
        body: { error: err.message || fallbackMessage } as any,
      };
    }
  }

  async get<T>(
    path: string,
    config: HttpRequestConfig = {},
    fallbackMessage = 'Failed to fetch data'
  ): Promise<HttpResponse<T>> {
    return this.request<T>('GET', path, undefined, config, fallbackMessage);
  }

  async post<T, D = unknown>(
    path: string,
    data: D,
    config: HttpRequestConfig = {},
    fallbackMessage = 'Failed to post data'
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', path, data, config, fallbackMessage);
  }

  async put<T, D = unknown>(
    path: string,
    data: D,
    config: HttpRequestConfig = {},
    fallbackMessage = 'Failed to update data'
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', path, data, config, fallbackMessage);
  }

  async delete<T, D = unknown>(
    path: string,
    data?: D,
    config: HttpRequestConfig = {},
    fallbackMessage = 'Failed to delete data'
  ): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', path, data, config, fallbackMessage);
  }

  normalizeStatus(status: number): number {
    return status >= 200 && status < 300 ? 200 : status;
  }

  formatStatusResponse(response: HttpResponse<any>, successMsg: string) {
    const isSuccess = response.status >= 200 && response.status < 300;
    return {
      success: isSuccess,
      message: isSuccess
        ? successMsg
        : response.body?.message || response.body?.error || 'Unexpected error',
    };
  }
}
