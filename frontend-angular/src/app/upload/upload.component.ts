import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { timeout, TimeoutError } from 'rxjs';
import { OcrService } from '../ocr.service';

interface OcrResult {
  text: string;
  readProbability: number | null;
  status: string;
  raw: unknown;
}

@Component({
  selector: 'app-upload',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="upload-container">
      <h2>Invoice OCR</h2>

      <div class="upload-area" [class.has-file]="selectedFile">
        <input id="fileInput" type="file" (change)="onFileSelected($event)" accept="image/*,.pdf" />
        <label for="fileInput">
          {{ selectedFile ? selectedFile.name : 'Click to select an invoice (image or PDF)' }}
        </label>
      </div>

      <button (click)="upload()" [disabled]="!selectedFile || loading">
        {{ loading ? 'Processing...' : 'Extract Text' }}
      </button>

      @if (loading) {
      <div class="loading-box">
        <div class="spinner"></div>
        <p>Extracting text from invoice… this may take up to 60 seconds.</p>
      </div>
      }

      @if (errorMessage) {
      <div class="error">{{ errorMessage }}</div>
      }

      @if (result) {
      <div class="result">
        <div class="meta">
          <span class="status-badge" [class]="statusClass">{{ result.status }}</span>
          @if (result.readProbability !== null) {
          <span class="confidence">Confidence: {{ result.readProbability }}%</span>
          }
        </div>
        <h3>Extracted Text</h3>
        <pre>{{ result.text || '(No text detected)' }}</pre>

        @if (rawResponseJson) {
        <div class="raw-response">
          <h3>API Response</h3>
          <pre>{{ rawResponseJson }}</pre>
        </div>
        }
      </div>
      }
    </div>
  `,
  styles: [`
    .upload-container {
      max-width: 700px;
      margin: 40px auto;
      padding: 28px;
      font-family: 'Segoe UI', sans-serif;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    h2 { margin: 0 0 20px; font-size: 1.5rem; color: #1a1a1a; }
    h3 { margin: 0 0 8px; font-size: 1rem; color: #333; }

    .upload-area {
      border: 2px dashed #ccc;
      border-radius: 6px;
      padding: 20px;
      text-align: center;
      margin-bottom: 14px;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .upload-area:hover, .upload-area.has-file { border-color: #0078d4; }
    .upload-area input[type="file"] { display: none; }
    .upload-area label { cursor: pointer; color: #555; font-size: 0.95rem; }

    button {
      padding: 10px 22px;
      background: #0078d4;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 0.95rem;
      cursor: pointer;
    }
    button:hover:not(:disabled) { background: #005fa3; }
    button:disabled { opacity: 0.5; cursor: default; }

    .error { color: #c00; margin-top: 14px; font-size: 0.9rem; }

    .loading-box {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 18px;
      padding: 14px 16px;
      background: #eef4ff;
      border: 1px solid #c2d6ff;
      border-radius: 6px;
      color: #1a4db5;
      font-size: 0.9rem;
    }
    .loading-box p { margin: 0; }
    .spinner {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      border: 3px solid #c2d6ff;
      border-top-color: #1a4db5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .result { margin-top: 24px; }
    .raw-response { margin-top: 16px; }

    .meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .status-badge {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .crystal { background: #d4edda; color: #155724; }
    .readable { background: #fff3cd; color: #856404; }
    .low { background: #f8d7da; color: #721c24; }
    .none { background: #e2e3e5; color: #383d41; }

    .confidence { font-size: 0.88rem; color: #555; }

    pre {
      background: #f5f7fa;
      border: 1px solid #e0e4ea;
      border-radius: 4px;
      padding: 16px;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.9rem;
      line-height: 1.6;
      max-height: 420px;
      overflow-y: auto;
    }
  `]
})
export class UploadComponent {
  private readonly ocrService = inject(OcrService);
  private readonly cdr = inject(ChangeDetectorRef);

  selectedFile: File | null = null;
  result: OcrResult | null = null;
  rawResponseJson = '';
  errorMessage: string | null = null;
  loading = false;

  get statusClass(): string {
    if (!this.result) return '';
    const s = this.result.status;
    if (s === 'Crystal Clear') return 'status-badge crystal';
    if (s === 'Readable') return 'status-badge readable';
    if (s === 'Low Quality') return 'status-badge low';
    return 'status-badge none';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.result = null;
    this.rawResponseJson = '';
    this.errorMessage = null;
    this.cdr.markForCheck();
  }

  upload(): void {
    if (!this.selectedFile) return;
    this.loading = true;
    this.errorMessage = null;
    this.result = null;
    this.rawResponseJson = '';

    this.ocrService.upload(this.selectedFile).pipe(timeout(120_000)).subscribe({
      next: (response: unknown) => {
        this.result = this.normalizeResponse(response);
        this.rawResponseJson = this.stringifyResponse(response);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        if (err instanceof TimeoutError) {
          this.errorMessage = 'Request timed out. The OCR is taking too long — try a smaller or clearer image.';
        } else {
          this.errorMessage = err?.error?.message ?? 'Upload failed. Make sure all 3 services are running.';
        }
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private normalizeResponse(response: unknown): OcrResult {
    const payload = this.asRecord(response);
    const text = this.pickString(payload, ['text', 'Text', 'extractedText', 'ExtractedText', 'content', 'Content']);
    const status = this.pickString(payload, ['status', 'Status', 'message', 'Message']) || 'Completed';
    const readProbability = this.pickNumber(payload, [
      'readProbability',
      'ReadProbability',
      'confidence',
      'Confidence',
      'score',
      'Score'
    ]);

    return {
      text,
      status,
      readProbability,
      raw: response
    };
  }

  private stringifyResponse(response: unknown): string {
    if (typeof response === 'string') {
      return response;
    }

    try {
      return JSON.stringify(response, null, 2);
    } catch {
      return String(response);
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object') {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private pickString(source: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    return '';
  }

  private pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
        return Number(value);
      }
    }

    return null;
  }
}
