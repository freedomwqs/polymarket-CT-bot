import axios from 'axios';

const fetchData = async (url: string) => {
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.get(url, { timeout: 15000 });
            return response.data;
        } catch (error) {
            lastError = error;
            if (attempt < 3) {
                const delay = Math.min(500 * Math.pow(2, attempt - 1), 3000);
                await new Promise((r) => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
};

export default fetchData;
