"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeClient = exports.KnowledgeClientError = exports.KnowledgeResponseSchema = void 0;
const axios_1 = __importStar(require("axios"));
const zod_1 = require("zod");
exports.KnowledgeResponseSchema = zod_1.z.object({
    answer: zod_1.z.string(),
    source_urls: zod_1.z.array(zod_1.z.string().url()),
    confidence: zod_1.z.number().min(0).max(1),
    needs_human: zod_1.z.boolean(),
});
class KnowledgeClientError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.name = "KnowledgeClientError";
        this.cause = cause;
    }
}
exports.KnowledgeClientError = KnowledgeClientError;
class KnowledgeClient {
    http;
    baseUrl;
    constructor(options = {}) {
        this.baseUrl = options.baseUrl ?? "http://127.0.0.1:8000";
        this.http =
            options.http ??
                axios_1.default.create({
                    baseURL: this.baseUrl,
                    timeout: options.timeoutMs ?? 5000,
                    headers: { "Content-Type": "application/json" },
                });
    }
    async query(question, topK = 5) {
        if (question.trim().length < 3) {
            throw new KnowledgeClientError("Knowledge questions must contain at least three characters");
        }
        try {
            const response = await this.http.post("/query", {
                question,
                top_k: topK,
            });
            return exports.KnowledgeResponseSchema.parse(response.data);
        }
        catch (error) {
            if (error instanceof KnowledgeClientError) {
                throw error;
            }
            const detail = error instanceof axios_1.AxiosError
                ? error.code === "ECONNABORTED"
                    ? "request timed out"
                    : error.message
                : "unexpected client failure";
            throw new KnowledgeClientError(`Knowledge Brain query failed: ${detail}`, error);
        }
    }
}
exports.KnowledgeClient = KnowledgeClient;
