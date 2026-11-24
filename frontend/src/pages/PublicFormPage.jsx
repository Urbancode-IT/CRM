import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import BrandMark from '../components/BrandMark';
import { BRAND_NAME } from '../constants/brand';

export default function PublicFormPage() {
  const { token } = useParams();
  const [form, setForm] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .get(`/public/forms/${token}`)
      .then((res) => {
        setForm(res.data.form);
        const initial = {};
        (res.data.form.fields || []).forEach((f) => {
          initial[f.key] = f.defaultValue || '';
        });
        setValues(initial);
      })
      .catch((err) => setError(err.response?.data?.message || 'Form not found'));
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/public/forms/${token}/submit`, { values });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Submit failed');
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-brand-100 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">Thanks — response submitted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <BrandMark className="h-8 w-8" />
          <span className="font-display text-lg font-semibold">{BRAND_NAME}</span>
        </div>
        {error && <div className="mb-4 rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
        {form && (
          <form onSubmit={submit} className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">{form.name}</h1>
            {form.description && <p className="mt-1 text-sm text-slate-500">{form.description}</p>}
            <div className="mt-4 space-y-3">
              {(form.fields || []).map((field) => (
                <label key={field.key} className="block text-sm">
                  <span className="mb-1 block text-slate-600">
                    {field.name}
                    {field.required ? ' *' : ''}
                  </span>
                  {field.type === 'textarea' ? (
                    <textarea
                      required={field.required}
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      className="w-full rounded-md border border-brand-200 px-3 py-2"
                      rows={3}
                    />
                  ) : field.type === 'select' || field.type === 'dropdown' ? (
                    <select
                      required={field.required}
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      className="w-full rounded-md border border-brand-200 px-3 py-2"
                    >
                      <option value="">Select</option>
                      {(field.options || []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                      required={field.required}
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      className="w-full rounded-md border border-brand-200 px-3 py-2"
                    />
                  )}
                </label>
              ))}
            </div>
            <button type="submit" className="mt-5 w-full rounded-md bg-brand-600 px-3 py-2 text-sm text-white">
              Submit
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
