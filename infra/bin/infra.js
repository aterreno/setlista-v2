#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const setlista_stack_1 = require("../lib/setlista-stack");
const app = new cdk.App();
new setlista_stack_1.SetlistaStack(app, 'SetlistaStack', {
    env: {
        account: '836481963552',
        region: 'us-east-1',
    },
    description: 'Setlista application infrastructure',
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLDBEQUFzRDtBQUV0RCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixJQUFJLDhCQUFhLENBQUMsR0FBRyxFQUFFLGVBQWUsRUFBRTtJQUN0QyxHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsY0FBYztRQUN2QixNQUFNLEVBQUUsV0FBVztLQUNwQjtJQUNELFdBQVcsRUFBRSxxQ0FBcUM7Q0FDbkQsQ0FBQyxDQUFDO0FBRUgsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFNldGxpc3RhU3RhY2sgfSBmcm9tICcuLi9saWIvc2V0bGlzdGEtc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG5uZXcgU2V0bGlzdGFTdGFjayhhcHAsICdTZXRsaXN0YVN0YWNrJywge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiAnODM2NDgxOTYzNTUyJyxcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICB9LFxuICBkZXNjcmlwdGlvbjogJ1NldGxpc3RhIGFwcGxpY2F0aW9uIGluZnJhc3RydWN0dXJlJyxcbn0pO1xuXG5hcHAuc3ludGgoKTsiXX0=