import { Injectable, Logger } from '@nestjs/common';
import { AnalyzeDocumentCommand, TextractClient } from '@aws-sdk/client-textract';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

@Injectable()
export class AwsIntegrationService {
  private readonly logger = new Logger(AwsIntegrationService.name);
  private readonly textractClient = new TextractClient({});
  private readonly bedrockClient = new BedrockRuntimeClient({});

  async parseDocumentWithTextract(buffer: Buffer) {
    try {
      const command = new AnalyzeDocumentCommand({
        Document: { Bytes: buffer },
        FeatureTypes: ['TABLES', 'FORMS'],
      });

      const response = await this.textractClient.send(command);
      const blocks = response.Blocks ?? [];

      const textBlocks = blocks.filter((block) => block.BlockType === 'LINE');
      const pageText = textBlocks.map((block) => block.Text).filter(Boolean).join('\n');

      const tableBlocks = blocks.filter((block) => block.BlockType === 'TABLE');
      const tables = tableBlocks.map((table) => ({ id: table.Id, rowCount: table.RowIndex, columnCount: table.ColumnIndex }));

      return { text: pageText, tables, raw: response };
    } catch (error) {
      this.logger.error('Textract extract error', error as Error);
      if ((error as any).name === 'ThrottlingException') {
        throw new Error('Textract service limit exceeded. Please retry with backoff.');
      }
      throw error;
    }
  }

  private async streamToString(stream: any): Promise<string> {
    if (!stream) return '';
    if (typeof stream === 'string') return stream;
    if (Buffer.isBuffer(stream)) return stream.toString('utf-8');

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf-8');
  }

  private async invokeBedrockModel(modelId: string, payload: object) {
    try {
      const body = JSON.stringify(payload);
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body,
      });

      const response = await this.bedrockClient.send(command);
      const textBody = await this.streamToString(response.body);
      if (!textBody) throw new Error('No response body from Bedrock model');

      try {
        return JSON.parse(textBody);
      } catch (e) {
        this.logger.warn('Bedrock response is not JSON, returning raw body');
        return { outputText: textBody };
      }
    } catch (error) {
      this.logger.error(`Bedrock invokeModel failed for ${modelId}`, error as Error);
      if ((error as any).name === 'ThrottlingException') {
        throw new Error('Bedrock service limit exceeded. Please retry with backoff.');
      }
      throw error;
    }
  }

  async generateEmbeddings(text: string) {
    const result = await this.invokeBedrockModel('amazon.titan-embed-text-v2:0', {
      inputText: text,
    });

    if (!result?.embedding) {
      throw new Error('Unexpected Bedrock Titan embedding response format');
    }

    if (!Array.isArray(result.embedding) || result.embedding.length !== 1536) {
      throw new Error('Embedding dimension mismatch. Expected 1536');
    }

    return result.embedding;
  }

  async generateDraftAnswer(prompt: string) {
    const result = await this.invokeBedrockModel('anthropic.claude-3-5-sonnet-20240620-v1:0', {
      input: prompt,
      max_tokens_to_sample: 1024,
      temperature: 0.2,
    });

    if (!result?.outputText && !result?.output) {
      throw new Error('Unexpected Bedrock Claude response format');
    }

    return (result.outputText ?? result.output) as string;
  }
}
