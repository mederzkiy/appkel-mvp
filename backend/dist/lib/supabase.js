"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
exports.createUserClient = createUserClient;
const supabase_js_1 = require("@supabase/supabase-js");
const env_js_1 = require("../config/env.js");
// Сервисный клиент (обходит RLS — для ботов, админки и верификации)
exports.supabaseAdmin = (0, supabase_js_1.createClient)(env_js_1.config.supabase.url, env_js_1.config.supabase.serviceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});
// Создание клиента с контекстом пользователя (RLS применяется автоматически)
function createUserClient(jwt) {
    return (0, supabase_js_1.createClient)(env_js_1.config.supabase.url, env_js_1.config.supabase.anonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${jwt}`,
            },
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
