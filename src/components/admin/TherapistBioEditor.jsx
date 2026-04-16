import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Save, Upload, User } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function TherapistBioEditor() {
  const { toast } = useToast();
  const [bio, setBio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', title: '', bio: '', photo_url: '' });

  useEffect(() => { loadBio(); }, []);

  const loadBio = async () => {
    const bios = await base44.entities.TherapistBio.list();
    if (bios.length > 0) {
      setBio(bios[0]);
      setForm({ name: bios[0].name || '', title: bios[0].title || '', bio: bios[0].bio || '', photo_url: bios[0].photo_url || '' });
    }
    setLoading(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, photo_url: file_url }));
    setUploading(false);
    toast({ title: 'Photo uploaded!' });
  };

  const save = async () => {
    setSaving(true);
    if (bio) {
      await base44.entities.TherapistBio.update(bio.id, form);
    } else {
      const created = await base44.entities.TherapistBio.create(form);
      setBio(created);
    }
    toast({ title: 'Bio saved!' });
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Photo */}
      <div className="flex items-center gap-4">
        {form.photo_url ? (
          <img src={form.photo_url} alt="Therapist" className="w-20 h-20 rounded-full object-cover border-2 border-indigo-100" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
            <User className="w-10 h-10 text-indigo-400" />
          </div>
        )}
        <div>
          <input type="file" accept="image/*" id="bio-photo" className="hidden" onChange={handlePhotoUpload} />
          <Button variant="outline" size="sm" onClick={() => document.getElementById('bio-photo').click()} disabled={uploading}>
            {uploading ? <LoadingSpinner size="sm" /> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Photo</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Name</Label>
          <Input className="mt-1" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sarah Johnson" />
        </div>
        <div>
          <Label>Title</Label>
          <Input className="mt-1" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Licensed Massage Therapist" />
        </div>
      </div>

      <div>
        <Label>Bio</Label>
        <Textarea className="mt-1 resize-none h-24" value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="A short bio displayed on the home page..." />
      </div>

      <Button onClick={save} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700">
        {saving ? <LoadingSpinner size="sm" /> : <><Save className="w-4 h-4 mr-2" /> Save Bio</>}
      </Button>
    </div>
  );
}