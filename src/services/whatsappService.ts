import axios from "axios";

const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";

function formatPhoneNumber(input: string) {
  if (!input) return "";

  // Convert to string
  let phone = input.toString();

  // Remove all non-digit characters
  phone = phone.replace(/\D/g, "");

  // Handle different cases
  if (phone.startsWith("01")) {
    // Add 88 in front
    phone = "88" + phone;
  } else if (phone.startsWith("8801")) {
    // Already correct
    return phone;
  } else if (phone.startsWith("88")) {
    // Assume already correct
    return phone;
  }

  return phone;
}

export class WhatsappService {
  /**
   * Send WhatsApp template message: task_update
   * @param to - recipient phone (e.g., 8801966362744)
   * @param param1 - first template variable
   * @param param2 - second template variable
   * @param param3 - third template variable
   */
  static async sendTaskUpdate(
    to: string,
    param1: string,
    param2: string,
    param3: string,
  ): Promise<any> {
    try {
      const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

      const payload = {
        messaging_product: "whatsapp",
        to: formatPhoneNumber(to),
        type: "template",
        template: {
          name: "task_update",
          language: {
            code: "en", // change if needed
          },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: param1 },
                { type: "text", text: param2 },
                { type: "text", text: param3 },
              ],
            },
          ],
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      return response.data;
    } catch (error: any) {
      console.error(
        "WhatsApp send error:",
        error?.response?.data || error.message,
      );
      throw error;
    }
  }
}
