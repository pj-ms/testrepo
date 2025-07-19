import { Hono } from 'hono';
declare const app: Hono<{
    Bindings: Env;
}, import("hono/types").BlankSchema, "/">;
declare const routes: import("hono/hono-base").HonoBase<{
    Bindings: Env;
}, {
    "/api": {
        $get: {
            input: {};
            output: "Hello World!";
            outputFormat: "text";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/echo": {
        $post: {
            input: {
                json: {
                    field1: string;
                    field2: number;
                };
            };
            output: {
                field1: string;
                field2: number;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/d1-demo": {
        $get: {
            input: {};
            output: {
                id: string;
                description: string;
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/">;
export default app;
export type AppType = typeof routes;
