import toast from 'react-hot-toast';

export function toastSuccess(message) {
  return toast.success(message, { duration: 3200 });
}

export function toastError(message) {
  return toast.error(message || 'Something went wrong', { duration: 4200 });
}

export function toastInfo(message) {
  return toast(message, { duration: 3200 });
}

export { toast };
