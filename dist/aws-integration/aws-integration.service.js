"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AwsIntegrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsIntegrationService = void 0;
const common_1 = require("@nestjs/common");
const client_textract_1 = require("@aws-sdk/client-textract");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
let AwsIntegrationService = AwsIntegrationService_1 = class AwsIntegrationService {
    logger = new common_1.Logger(AwsIntegrationService_1.name);
    textractClient = new client_textract_1.TextractClient({});
    bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({});
    async parseDocumentWithTextract(buffer) {
        try {
            const command = new client_textract_1.AnalyzeDocumentCommand({
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
        }
        catch (error) {
            this.logger.error('Textract extract error', error);
            if (error.name === 'ThrottlingException') {
                throw new Error('Textract service limit exceeded. Please retry with backoff.');
            }
            throw error;
        }
    }
    async streamToString(stream) {
        if (!stream)
            return '';
        if (typeof stream === 'string')
            return stream;
        if (Buffer.isBuffer(stream))
            return stream.toString('utf-8');
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf-8');
    }
    async invokeBedrockModel(modelId, payload) {
        try {
            const body = JSON.stringify(payload);
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body,
            });
            const response = await this.bedrockClient.send(command);
            const textBody = await this.streamToString(response.body);
            if (!textBody)
                throw new Error('No response body from Bedrock model');
            try {
                return JSON.parse(textBody);
            }
            catch (e) {
                this.logger.warn('Bedrock response is not JSON, returning raw body');
                return { outputText: textBody };
            }
        }
        catch (error) {
            this.logger.error(`Bedrock invokeModel failed for ${modelId}`, error);
            if (error.name === 'ThrottlingException') {
                throw new Error('Bedrock service limit exceeded. Please retry with backoff.');
            }
            throw error;
        }
    }
    async generateEmbeddings(text) {
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
    async generateDraftAnswer(prompt) {
        const result = await this.invokeBedrockModel('anthropic.claude-3-5-sonnet-20240620-v1:0', {
            input: prompt,
            max_tokens_to_sample: 1024,
            temperature: 0.2,
        });
        if (!result?.outputText && !result?.output) {
            throw new Error('Unexpected Bedrock Claude response format');
        }
        return (result.outputText ?? result.output);
    }
};
exports.AwsIntegrationService = AwsIntegrationService;
exports.AwsIntegrationService = AwsIntegrationService = AwsIntegrationService_1 = __decorate([
    (0, common_1.Injectable)()
], AwsIntegrationService);
//# sourceMappingURL=aws-integration.service.js.map