import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Eye, Ban, CheckCircle, Users, AlertTriangle, UserCheck, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  full_name: string;
  user_type: 'client' | 'artist' | 'admin';
  status: 'active' | 'inactive';
  created_at: string;
}

interface Infraction {
  id: string;
  user_id: string;
  reported_user_id: string;
  description: string;
  detailed_description: string;
  status: 'pending' | 'resolved';
  created_at: string;
  reported_user?: {
    full_name: string;
    email: string;
  };
  reporter?: {
    full_name: string;
    email: string;
  };
}

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [isInfractionModalOpen, setIsInfractionModalOpen] = useState(false);

  // Verificar si el usuario es admin
  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single();

      if (!profile || profile.user_type !== 'admin') {
        toast.error('Acceso denegado. Solo los administradores pueden acceder a esta página.');
        navigate('/');
        return;
      }
    };

    checkAdminAccess();
  }, [navigate]);

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar usuarios
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('id, email, full_name, user_type, status, created_at')
          .order('created_at', { ascending: false });

        if (usersError) throw usersError;
        setUsers(usersData || []);

        // Cargar infracciones con información de usuarios
        const { data: infractionsData, error: infractionsError } = await supabase
          .from('infractions')
          .select(`
            id,
            user_id,
            reported_user_id,
            description,
            detailed_description,
            status,
            created_at,
            reported_user:profiles!infractions_reported_user_id_fkey(full_name, email),
            reporter:profiles!infractions_user_id_fkey(full_name, email)
          `)
          .order('created_at', { ascending: false });

        if (infractionsError) throw infractionsError;
        setInfractions(infractionsData || []);

      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filtrar usuarios por búsqueda
  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Función para bloquear usuario
  const handleBlockUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'inactive' })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: 'inactive' } : user
      ));

      toast.success('Usuario bloqueado exitosamente');
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Error al bloquear el usuario');
    }
  };

  // Función para resolver infracción
  const handleResolveInfraction = async (infractionId: string) => {
    try {
      const { error } = await supabase
        .from('infractions')
        .update({ status: 'resolved' })
        .eq('id', infractionId);

      if (error) throw error;

      setInfractions(infractions.map(infraction => 
        infraction.id === infractionId ? { ...infraction, status: 'resolved' } : infraction
      ));

      setIsInfractionModalOpen(false);
      toast.success('Infracción resuelta exitosamente');
    } catch (error) {
      console.error('Error resolving infraction:', error);
      toast.error('Error al resolver la infracción');
    }
  };

  // Función para abrir modal de detalles de infracción
  const handleViewInfractionDetails = (infraction: Infraction) => {
    setSelectedInfraction(infraction);
    setIsInfractionModalOpen(true);
  };

  // Estadísticas
  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'active').length,
    pendingInfractions: infractions.filter(i => i.status === 'pending').length,
    resolvedInfractions: infractions.filter(i => i.status === 'resolved').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard de Administración</h1>
          <p className="text-gray-600">Gestiona usuarios e infracciones de la plataforma</p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeUsers}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Infracciones Pendientes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingInfractions}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Infracciones Resueltas</CardTitle>
              <Activity className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.resolvedInfractions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de Usuarios */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-xl font-semibold">Gestión de Usuarios</CardTitle>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha de Registro</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name || 'Sin nombre'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.user_type === 'admin' ? 'destructive' : user.user_type === 'artist' ? 'default' : 'secondary'}>
                          {user.user_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                          {user.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {user.status === 'active' && user.user_type !== 'admin' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Ban className="h-4 w-4 mr-1" />
                                Bloquear
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción bloqueará al usuario {user.full_name || user.email}. 
                                  El usuario no podrá acceder a la plataforma hasta que sea desbloqueado.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleBlockUser(user.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Bloquear Usuario
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Infracciones */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Gestión de Infracciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario Reportado</TableHead>
                    <TableHead>Reportado Por</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {infractions.map((infraction) => (
                    <TableRow key={infraction.id}>
                      <TableCell className="font-medium">
                        {infraction.reported_user?.full_name || 'Usuario desconocido'}
                      </TableCell>
                      <TableCell>
                        {infraction.reporter?.full_name || 'Usuario desconocido'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {infraction.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant={infraction.status === 'pending' ? 'destructive' : 'default'}>
                          {infraction.status === 'pending' ? 'Pendiente' : 'Resuelta'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(infraction.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewInfractionDetails(infraction)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Modal de Detalles de Infracción */}
        <Dialog open={isInfractionModalOpen} onOpenChange={setIsInfractionModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalles de la Infracción</DialogTitle>
            </DialogHeader>
            {selectedInfraction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Usuario Reportado</h4>
                    <p className="text-sm">{selectedInfraction.reported_user?.full_name || 'Usuario desconocido'}</p>
                    <p className="text-xs text-gray-500">{selectedInfraction.reported_user?.email}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Reportado Por</h4>
                    <p className="text-sm">{selectedInfraction.reporter?.full_name || 'Usuario desconocido'}</p>
                    <p className="text-xs text-gray-500">{selectedInfraction.reporter?.email}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm text-gray-600">Descripción Breve</h4>
                  <p className="text-sm">{selectedInfraction.description}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm text-gray-600">Descripción Detallada</h4>
                  <p className="text-sm bg-gray-50 p-3 rounded-md">
                    {selectedInfraction.detailed_description || 'No hay descripción detallada disponible.'}
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Estado</h4>
                    <Badge variant={selectedInfraction.status === 'pending' ? 'destructive' : 'default'}>
                      {selectedInfraction.status === 'pending' ? 'Pendiente' : 'Resuelta'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Fecha</h4>
                    <p className="text-sm">{new Date(selectedInfraction.created_at).toLocaleString()}</p>
                  </div>
                </div>
                
                {selectedInfraction.status === 'pending' && (
                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      onClick={() => handleResolveInfraction(selectedInfraction.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolver Infracción
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Admin;