const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/FIREBASE_PRIVATE_KEY="(.*?)"/s);
if (match) {
    const pk = match[1];
    console.log('Parsed match[1]:', JSON.stringify(pk));
    // The issue: the literal string contains actual \n characters inside the double quotes, not escaped \\n
    // Next.js handles this in a specific way. If the user wrote `"-----BEGIN PRIVATE KEY-----\nMII..."`
    // Let's test the replace logic
    const replaced1 = pk.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
    console.log('replaced1:', JSON.stringify(replaced1));
} else {
    console.log("No match found");
}
