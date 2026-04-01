"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftModule = void 0;
const common_1 = require("@nestjs/common");
const draft_worker_1 = require("./draft.worker");
const aws_integration_module_1 = require("../aws-integration/aws-integration.module");
let DraftModule = class DraftModule {
};
exports.DraftModule = DraftModule;
exports.DraftModule = DraftModule = __decorate([
    (0, common_1.Module)({
        imports: [aws_integration_module_1.AwsIntegrationModule],
        providers: [draft_worker_1.DraftWorker],
        exports: [draft_worker_1.DraftWorker],
    })
], DraftModule);
//# sourceMappingURL=draft.module.js.map