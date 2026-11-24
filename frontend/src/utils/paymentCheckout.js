function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({
  keyId,
  amount,
  currency,
  orderId,
  name,
  description,
  prefill,
}) {
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  if (!window.Razorpay) throw new Error('Razorpay SDK failed to load');

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: keyId,
      amount: Math.round(Number(amount) * 100),
      currency: currency || 'INR',
      name: name || 'Subscription',
      description: description || '',
      order_id: orderId,
      prefill: prefill || {},
      handler(response) {
        resolve(response);
      },
      modal: {
        ondismiss() {
          reject(new Error('Payment cancelled'));
        },
      },
    });
    rzp.on('payment.failed', (response) => {
      reject(new Error(response?.error?.description || 'Razorpay payment failed'));
    });
    rzp.open();
  });
}

export async function openCashfreeCheckout({ paymentSessionId, mode = 'sandbox' }) {
  await loadScript('https://sdk.cashfree.com/js/v3/cashfree.js');
  if (!window.Cashfree) throw new Error('Cashfree SDK failed to load');

  const cashfree = window.Cashfree({ mode: mode === 'production' ? 'production' : 'sandbox' });
  const result = await cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_modal',
  });

  if (result?.error) {
    throw new Error(result.error.message || 'Cashfree checkout failed');
  }

  // User closed modal without paying
  if (result?.paymentDetails == null && result?.redirect === false) {
    throw new Error('Payment cancelled');
  }

  return result;
}
