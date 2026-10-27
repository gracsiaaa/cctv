import React, { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Search, UserPlus, Sparkles, Edit3, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface PersonItem {
  name: string;
  embeddings_count: number;
}

interface EmployeeMetadata {
  name: string;
  employee_code?: string;
  department?: string;
  position?: string;
  shift_id?: string;
}

interface ShiftItem {
  id: string;
  name: string;
}

export const PeoplePage: React.FC = () => {
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [employees, setEmployees] = useState<Record<string, EmployeeMetadata>>({});
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Delete modal state
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Edit modal state
  const [editPerson, setEditPerson] = useState<EmployeeMetadata | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editEmployeeCode, setEditEmployeeCode] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editShiftId, setEditShiftId] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [facesRes, empRes, shiftsRes] = await Promise.all([
        apiClient.get("/registered-faces"),
        apiClient.get("/employees"),
        apiClient.get("/shifts")
      ]);

      setPeople(facesRes.data.faces || []);
      setShifts(shiftsRes.data.shifts || []);

      const empMap: Record<string, EmployeeMetadata> = {};
      (empRes.data.employees || []).forEach((e: EmployeeMetadata) => {
        empMap[e.name] = e;
      });
      setEmployees(empMap);
    } catch (err) {
      console.error("Gagal mengambil data karyawan", err);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (name: string) => {
    setSelectedPerson(name);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedPerson) return;
    try {
      await apiClient.delete(`/delete-face/${selectedPerson}`);
      toast({
        title: "Wajah Dihapus",
        description: `Data karyawan ${selectedPerson} berhasil dihapus dari sistem`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedPerson(null);
      fetchData();
    } catch (err) {
      toast({
        title: "Gagal Menghapus",
        description: "Terjadi kesalahan saat menghapus data",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (person: PersonItem) => {
    const meta = employees[person.name] || {
      name: person.name,
      employee_code: `EMP-${Math.abs(person.name.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % 1000}`,
      department: "Operasional",
      position: "Staff",
      shift_id: shifts[0]?.id || "shift_pagi"
    };

    setEditPerson(meta);
    setEditEmployeeCode(meta.employee_code || "");
    setEditDepartment(meta.department || "Operasional");
    setEditPosition(meta.position || "Staff");
    setEditShiftId(meta.shift_id || shifts[0]?.id || "shift_pagi");
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPerson) return;

    try {
      setEditSaving(true);
      const payload = {
        name: editPerson.name,
        employee_code: editEmployeeCode,
        department: editDepartment,
        position: editPosition,
        shift_id: editShiftId
      };

      await apiClient.put(`/employees/${encodeURIComponent(editPerson.name)}`, payload);

      toast({
        title: "Data Diperbarui",
        description: `Informasi data karyawan ${editPerson.name} berhasil disimpan`,
      });

      setIsEditDialogOpen(false);
      setEmployees((prev) => ({
        ...prev,
        [editPerson.name]: payload
      }));
    } catch (err: any) {
      toast({
        title: "Gagal Menyimpan",
        description: err.response?.data?.detail || "Gagal memperbarui profil karyawan",
        variant: "destructive"
      });
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Database Karyawan</h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Kelola profil, jabatan, departemen, shift kerja, dan sampel vektor wajah karyawan
          </p>
        </div>
        <Link to="/register">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Registrasi Wajah Baru
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
        <Input
          placeholder="Cari nama karyawan..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="bg-zinc-900 border-zinc-800 pl-9 text-white h-10"
        />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden shadow-xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-zinc-800 bg-zinc-950/50">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="w-16">No</TableHead>
                  <TableHead>Nama & ID</TableHead>
                  <TableHead>Departemen & Jabatan</TableHead>
                  <TableHead>Shift Kerja</TableHead>
                  <TableHead>Model ArcFace</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                      Memuat database karyawan...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                      Tidak ada karyawan yang cocok
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((person, index) => {
                    const emp = employees[person.name];
                    const shiftName = shifts.find((s) => s.id === emp?.shift_id)?.name || "Shift Pagi";

                    return (
                      <TableRow key={person.name} className="border-zinc-800 hover:bg-zinc-800/40">
                        <TableCell className="font-medium text-zinc-400">{index + 1}</TableCell>
                        <TableCell className="font-medium text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs">
                              {person.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-white">{person.name}</div>
                              <div className="text-[11px] text-zinc-400 font-mono">
                                {emp?.employee_code || `EMP-${index + 101}`}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-zinc-300 font-medium">
                            {emp?.position || "Staff"}
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {emp?.department || "Operasional"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300">
                            {shiftName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
                            <Sparkles className="w-3 h-3" /> {person.embeddings_count} Foto Vektor
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(person)}
                            className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40"
                            title="Edit Data Karyawan"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(person.name)}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/50"
                            title="Hapus Karyawan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-zinc-400 text-sm">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-sm">Tidak ada karyawan terdaftar</div>
        ) : (
          filtered.map((person) => {
            const emp = employees[person.name];

            return (
              <Card key={person.name} className="bg-zinc-900 border-zinc-800 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm">
                      {person.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{person.name}</h4>
                      <span className="text-[11px] text-zinc-400">
                        {emp?.position || "Staff"} • {emp?.department || "Operasional"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(person)}
                      className="text-indigo-400 h-8 w-8"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(person.name)}
                      className="text-rose-400 h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-800/80">
                  <span className="text-[11px] text-zinc-400">
                    ID: {emp?.employee_code || "EMP-001"}
                  </span>
                  <span className="text-indigo-400 font-medium">
                    {person.embeddings_count} Foto Vektor
                  </span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit Employee Modal */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-400" /> Edit Profil Karyawan
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Ubah rincian metadata karyawan untuk keperluan laporan presensi.
            </DialogDescription>
          </DialogHeader>

          {editPerson && (
            <form onSubmit={handleSaveEdit} className="space-y-3.5 mt-2">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-300">Nama Karyawan</Label>
                <Input
                  disabled
                  value={editPerson.name}
                  className="bg-zinc-950/60 border-zinc-800 text-zinc-400 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-300">Nomor / ID Karyawan</Label>
                  <Input
                    value={editEmployeeCode}
                    onChange={(e) => setEditEmployeeCode(e.target.value)}
                    placeholder="EMP-001"
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-zinc-300">Shift Kerja</Label>
                  <select
                    value={editShiftId}
                    onChange={(e) => setEditShiftId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-300">Departemen / Divisi</Label>
                  <Input
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    placeholder="Contoh: IT, HRD..."
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-zinc-300">Jabatan / Posisi</Label>
                  <Input
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    placeholder="Contoh: Staff, Spv..."
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={editSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal (Shadcn Dialog) */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus Wajah</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              Apakah Anda yakin ingin menghapus data wajah untuk{" "}
              <strong className="text-white">{selectedPerson}</strong>? Tindakan ini akan menghapus semua vektor embedding yang tersimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Hapus Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
