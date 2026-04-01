export declare class AwsIntegrationService {
    private readonly logger;
    private readonly textractClient;
    private readonly bedrockClient;
    parseDocumentWithTextract(buffer: Buffer): Promise<{
        text: string;
        tables: {
            id: string | undefined;
            rowCount: number | undefined;
            columnCount: number | undefined;
        }[];
        raw: import("@aws-sdk/client-textract").AnalyzeDocumentCommandOutput;
    }>;
    private streamToString;
    private invokeBedrockModel;
    generateEmbeddings(text: string): Promise<any>;
    generateDraftAnswer(prompt: string): Promise<string>;
}
