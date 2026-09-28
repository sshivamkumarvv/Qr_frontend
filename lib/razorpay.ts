import { api, CreatePaymentOrderResponse, Order } from "./api";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export class PaymentCancelledError extends Error {
  constructor(message = "Payment was cancelled.") {
    super(message);
    this.name = "PaymentCancelledError";
  }
}

/**
 * Dynamically loads the Razorpay checkout.js script if not already present.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById("razorpay-checkout-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.id = "razorpay-checkout-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay Checkout script.");
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export interface RazorpayCheckoutOptions {
  order: {
    id: string;
    restaurantName?: string;
    customerName?: string;
    customerPhone?: string;
    total?: number;
    totalAmount?: number;
  };
  user?: {
    fullName?: string;
    phone?: string;
  } | null;
}

/**
 * Creates the Razorpay order via backend, opens the standard checkout modal,
 * and calls the backend verify endpoint upon completion.
 */
export async function processRazorpayPayment({
  order,
  user,
}: RazorpayCheckoutOptions): Promise<Order> {
  // 1. Create (or get existing) gateway order from backend
  const paymentOrder: CreatePaymentOrderResponse =
    await api.payments.createPaymentOrder(order.id);

  // 2. Handle Mock Mode (Dev mode when keys are not configured or mock is returned)
  if (paymentOrder.mock || paymentOrder.razorpayOrderId.startsWith("mock_order_")) {
    // Confirm simulated payment with backend
    const verifiedOrder = await api.payments.verifyPayment({
      orderId: order.id,
      razorpayOrderId: paymentOrder.razorpayOrderId,
      razorpayPaymentId: `mock_pay_${Date.now()}`,
      razorpaySignature: "mock_signature",
    });
    return verifiedOrder;
  }

  // 3. Ensure Razorpay Checkout script is loaded
  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded || !window.Razorpay) {
    throw new Error(
      "Razorpay SDK could not be loaded. Please check your internet connection and try again."
    );
  }

  // 4. Open Razorpay Checkout modal
  return new Promise<Order>((resolve, reject) => {
    let hasResolved = false;

    const options = {
      key: paymentOrder.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
      amount: paymentOrder.amount,
      currency: paymentOrder.currency || "INR",
      name: order.restaurantName || "DineIn Restaurant",
      description: `Order #${order.id.slice(0, 8).toUpperCase()}`,
      order_id: paymentOrder.razorpayOrderId,
      prefill: {
        name: order.customerName || user?.fullName || "",
        contact: order.customerPhone || user?.phone || "",
      },
      theme: {
        color: "#ff6b2b", // App primary accent color
      },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        hasResolved = true;
        try {
          // 5. Client-side signature verification with backend
          const verifiedOrder = await api.payments.verifyPayment({
            orderId: order.id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          resolve(verifiedOrder);
        } catch (err: any) {
          reject(
            new Error(
              err.message ||
                "Payment was successful but verification failed. Please contact restaurant staff."
            )
          );
        }
      },
      modal: {
        ondismiss: () => {
          if (!hasResolved) {
            reject(new PaymentCancelledError("Payment window was closed."));
          }
        },
        escape: true,
        backdropclose: false,
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        hasResolved = true;
        reject(
          new Error(
            response?.error?.description || "Payment failed. Please try another method."
          )
        );
      });
      rzp.open();
    } catch (err: any) {
      reject(new Error(err.message || "Could not launch Razorpay checkout modal."));
    }
  });
}
