// यह फ़ाइल Vercel/Netlify का सर्वरलेस फ़ंक्शन होगा।
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// ******************************************************************
// यहाँ आपकी गुप्त चाबियाँ डाली गई हैं। इन्हें ध्यान से कॉपी-पेस्ट करें।
// ******************************************************************
const TELEGRAM_BOT_TOKEN = '8575967001:AAFI-h-DsDiKEdLG0m0c3MXFYCQkTg5DS6Q'; 
const SUPABASE_URL = 'https://lklzdnayllonhvwypeie.supabase.co'; 
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrbHpkbmF5bGxvbmh2d3lwZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkwODk3MCwiZXhwIjoyMDc5NDg0OTcwfQ.a4egwtvAPX9ipRxJebdN_sT_r49ICod98yV5dPqJXQg'; 

// Supabase क्लाइंट
const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
});

// Telegram API URL
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Telegram पर संदेश भेजने का फ़ंक्शन
const sendMessage = async (chatId, text) => {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error sending message:', error.response?.data || error.message);
    }
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { message } = req.body;
    if (!message || !message.text) {
        return res.status(200).send('No text message received.');
    }

    const chatId = message.chat.id;
    const parts = message.text.split(' ');
    const command = parts[0]; 
    const token = parts[1]; 

    if (command === '/verify' && token && token.length === 6) {
        try {
            // 1. Supabase में टोकन से यूज़र को ढूंढें
            const { data: profile, error: fetchError } = await sbAdmin
                .from('profiles')
                .select('id, user_id') // user_id (Auth ID) भी Fetch करें
                .eq('verification_token', token)
                .single();

            if (fetchError || !profile || !profile.user_id) {
                await sendMessage(chatId, '❌ *गलत टोकन!* कृपया रजिस्ट्रेशन के दौरान दिया गया 6-अंकों का टोकन फिर से चेक करें।');
                return res.status(200).send('Token invalid or user not found');
            }

            const userId = profile.user_id;

            // 2. Telegram Chat ID को profiles टेबल में सेव करें
            const { error: updateError } = await sbAdmin
                .from('profiles')
                .update({ telegram_chat_id: chatId })
                .eq('id', profile.id);

            if (updateError) throw updateError;
            
            // 3. RPC फ़ंक्शन को कॉल करके Supabase Auth में यूज़र को सत्यापित करें
            const { error: confirmError } = await sbAdmin.rpc('confirm_telegram_verification', { user_id_input: userId });

            if (confirmError) throw confirmError;

            await sendMessage(chatId, '✅ *सत्यापन सफल!* आपका अकाउंट सत्यापित हो गया है। आप अब लॉग इन कर सकते हैं।');
            return res.status(200).send('Verified');

        } catch (error) {
            console.error('Verification failed:', error.message);
            await sendMessage(chatId, `❌ सत्यापन में त्रुटि हुई: ${error.message}`);
            return res.status(500).send('Verification failed');
        }
    } else if (command === '/start') {
        await sendMessage(chatId, 'नमस्ते! कृपया रजिस्ट्रेशन के बाद मिला हुआ कमांड *टोकन* के साथ भेजें। उदाहरण: `/verify 123456`');
    } else {
        return res.status(200).send('Ignored message');
    }
};
