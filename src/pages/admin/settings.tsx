import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import {
  AppBar, Toolbar, Typography, IconButton, Box, Grid, Card, CardContent, 
  Paper, CircularProgress, Button, TextField, Switch, FormControlLabel,
  Divider, Alert, Snackbar, useTheme, useMediaQuery, Container, Tabs, Tab,
  FormControl, InputLabel, Select, MenuItem, Slider, Chip, Avatar
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Store as StoreIcon,
  Palette as PaletteIcon,
  Schedule as ScheduleIcon,
  Payment as PaymentIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RestaurantSettings {
  id: number;
  name: string;
  address: string;
  cnpj: string;
  phone: string;
  email: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  currency: string;
  timezone: string;
  service_charge_percentage: number;
  accepts_cash: boolean;
  accepts_pix: boolean;
  accepts_card: boolean;
  delivery_available: boolean;
  takeaway_available: boolean;
  opening_hours: {
    [key: string]: {
      open: string;
      close: string;
      closed: boolean;
    };
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const weekDays = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

export default function Settings() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings>({
    id: 1,
    name: 'Meu Restaurante',
    address: '',
    cnpj: '',
    phone: '',
    email: '',
    logo_url: '',
    primary_color: '#1976d2',
    secondary_color: '#dc004e',
    currency: 'BRL',
    timezone: 'America/Sao_Paulo',
    service_charge_percentage: 10,
    accepts_cash: true,
    accepts_pix: true,
    accepts_card: true,
    delivery_available: true,
    takeaway_available: true,
    opening_hours: {
      monday: { open: '18:00', close: '23:00', closed: false },
      tuesday: { open: '18:00', close: '23:00', closed: false },
      wednesday: { open: '18:00', close: '23:00', closed: false },
      thursday: { open: '18:00', close: '23:00', closed: false },
      friday: { open: '18:00', close: '23:00', closed: false },
      saturday: { open: '18:00', close: '23:00', closed: false },
      sunday: { open: '18:00', close: '23:00', closed: true }
    }
  });
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Nenhum registro encontrado, usar valores padrão
          console.log('Nenhuma configuração encontrada, usando valores padrão');
        } else {
          throw error;
        }
      } else {
        setSettings(prev => ({
          ...prev,
          ...data,
          opening_hours: typeof data.opening_hours === 'string' 
            ? JSON.parse(data.opening_hours) 
            : data.opening_hours
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao carregar configurações',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const settingsToSave = {
        ...settings,
        opening_hours: JSON.stringify(settings.opening_hours)
      };

      const { error } = await supabase
        .from('restaurant_settings')
        .upsert(settingsToSave, { onConflict: 'id' });

      if (error) throw error;

      setSnackbar({
        open: true,
        message: 'Configurações salvas com sucesso!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setSnackbar({
        open: true,
        message: 'Erro ao salvar configurações',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof RestaurantSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verificar se é uma imagem
      if (!file.type.startsWith('image/')) {
        setSnackbar({
          open: true,
          message: 'Por favor, selecione apenas arquivos de imagem.',
          severity: 'error'
        });
        return;
      }
      
      // Verificar tamanho (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setSnackbar({
          open: true,
          message: 'A imagem deve ter no máximo 2MB.',
          severity: 'error'
        });
        return;
      }
      
      setSelectedLogoFile(file);
    }
  };

  const handleLogoUpload = async () => {
    if (!selectedLogoFile) return;
    
    setUploadingLogo(true);
    try {
      const fileExt = selectedLogoFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('logos')
        .upload(fileName, selectedLogoFile);
      
      if (error) throw error;
      
      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);
      
      updateSetting('logo_url', urlData.publicUrl);
      setSelectedLogoFile(null);
      
      setSnackbar({
        open: true,
        message: 'Logo enviado com sucesso!',
        severity: 'success'
      });
    } catch (error: any) {
      console.error('Erro ao enviar logo:', error);
      setSnackbar({
        open: true,
        message: `Erro ao enviar logo: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = () => {
    updateSetting('logo_url', '');
    setSelectedLogoFile(null);
  };

  const updateOpeningHour = (day: string, field: 'open' | 'close' | 'closed', value: any) => {
    setSettings(prev => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: {
          ...prev.opening_hours[day],
          [field]: value
        }
      }
    }));
  };

  const formatCNPJ = (value: string) => {
    const cnpj = value.replace(/\D/g, '');
    return cnpj.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5'
    );
  };

  const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, '');
    if (phone.length <= 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <CircularProgress size={60} sx={{ color: 'white' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ background: 'transparent' }}>
        <Toolbar>
          <IconButton 
            edge="start" 
            color="inherit" 
            onClick={() => router.push('/admin')}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Configurações do Restaurante
          </Typography>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={saveSettings}
            disabled={saving}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
              fontWeight: 600,
              borderRadius: 2
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: 4 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} variant={isMobile ? 'scrollable' : 'fullWidth'}>
                <Tab 
                  icon={<StoreIcon />} 
                  label="Geral" 
                  sx={{ fontWeight: 600, minHeight: 72 }}
                />
                <Tab 
                  icon={<PaletteIcon />} 
                  label="Aparência" 
                  sx={{ fontWeight: 600, minHeight: 72 }}
                />
                <Tab 
                  icon={<ScheduleIcon />} 
                  label="Horários" 
                  sx={{ fontWeight: 600, minHeight: 72 }}
                />
                <Tab 
                  icon={<PaymentIcon />} 
                  label="Pagamentos" 
                  sx={{ fontWeight: 600, minHeight: 72 }}
                />
              </Tabs>
            </Box>

            {/* Tab 1: Informações Gerais */}
            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 3, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <StoreIcon sx={{ mr: 1 }} />
                      Dados do Estabelecimento
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          label="Nome do Restaurante"
                          value={settings.name}
                          onChange={(e) => updateSetting('name', e.target.value)}
                          variant="outlined"
                          required
                        />
                      </Grid>
                      
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          label="Endereço Completo"
                          value={settings.address || ''}
                          onChange={(e) => updateSetting('address', e.target.value)}
                          variant="outlined"
                          multiline
                          rows={2}
                        />
                      </Grid>
                      
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="CNPJ"
                          value={settings.cnpj || ''}
                          onChange={(e) => {
                            const formatted = formatCNPJ(e.target.value);
                            if (formatted.length <= 18) {
                              updateSetting('cnpj', formatted);
                            }
                          }}
                          variant="outlined"
                          placeholder="00.000.000/0000-00"
                        />
                      </Grid>
                      
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="Telefone"
                          value={settings.phone || ''}
                          onChange={(e) => {
                            const formatted = formatPhone(e.target.value);
                            if (formatted.length <= 15) {
                              updateSetting('phone', formatted);
                            }
                          }}
                          variant="outlined"
                          placeholder="(11) 99999-9999"
                        />
                      </Grid>
                      
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          label="E-mail"
                          type="email"
                          value={settings.email || ''}
                          onChange={(e) => updateSetting('email', e.target.value)}
                          variant="outlined"
                        />
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 3, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <CloudUploadIcon sx={{ mr: 1 }} />
                      Logo & Configurações
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                          Logo do Restaurante
                        </Typography>
                        
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {/* Preview da logo atual */}
                          {settings.logo_url && (
                            <Card sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar
                                src={settings.logo_url}
                                sx={{ width: 60, height: 60 }}
                                variant="rounded"
                              />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  Logo atual
                                </Typography>
                              </Box>
                              <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                onClick={removeLogo}
                              >
                                Remover
                              </Button>
                            </Card>
                          )}
                          
                          {/* Upload de nova logo */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoFileSelect}
                              style={{ display: 'none' }}
                              id="logo-upload"
                            />
                            <label htmlFor="logo-upload">
                              <Button
                                variant="outlined"
                                component="span"
                                startIcon={<CloudUploadIcon />}
                                fullWidth
                                sx={{ py: 1.5 }}
                              >
                                Selecionar Nova Logo
                              </Button>
                            </label>
                            
                            {selectedLogoFile && (
                              <Card sx={{ p: 2, bgcolor: 'grey.50' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Typography variant="body2" sx={{ flex: 1 }}>
                                    {selectedLogoFile.name}
                                  </Typography>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleLogoUpload}
                                    disabled={uploadingLogo}
                                    startIcon={uploadingLogo ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                                  >
                                    {uploadingLogo ? 'Enviando...' : 'Enviar'}
                                  </Button>
                                </Box>
                              </Card>
                            )}
                            
                            <Typography variant="caption" color="text.secondary">
                              Formatos aceitos: JPG, PNG, GIF. Tamanho máximo: 2MB
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth>
                          <InputLabel>Moeda</InputLabel>
                          <Select
                            value={settings.currency || 'BRL'}
                            label="Moeda"
                            onChange={(e) => updateSetting('currency', e.target.value)}
                          >
                            <MenuItem value="BRL">Real (R$)</MenuItem>
                            <MenuItem value="USD">Dólar ($)</MenuItem>
                            <MenuItem value="EUR">Euro (€)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth>
                          <InputLabel>Fuso Horário</InputLabel>
                          <Select
                            value={settings.timezone || 'America/Sao_Paulo'}
                            label="Fuso Horário"
                            onChange={(e) => updateSetting('timezone', e.target.value)}
                          >
                            <MenuItem value="America/Sao_Paulo">São Paulo</MenuItem>
                            <MenuItem value="America/Rio_Branco">Rio Branco</MenuItem>
                            <MenuItem value="America/Manaus">Manaus</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid size={{ xs: 12 }}>
                        <Typography gutterBottom>
                          Taxa de Serviço: {settings.service_charge_percentage}%
                        </Typography>
                        <Slider
                          value={settings.service_charge_percentage || 10}
                          onChange={(e, value) => updateSetting('service_charge_percentage', value)}
                          min={0}
                          max={20}
                          step={1}
                          marks={[
                            { value: 0, label: '0%' },
                            { value: 10, label: '10%' },
                            { value: 20, label: '20%' }
                          ]}
                          valueLabelDisplay="auto"
                        />
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            {/* Tab 2: Aparência */}
            <TabPanel value={tabValue} index={1}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 3, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <PaletteIcon sx={{ mr: 1 }} />
                      Cores do Sistema
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <TextField
                            label="Cor Primária"
                            value={settings.primary_color || '#1976d2'}
                            onChange={(e) => updateSetting('primary_color', e.target.value)}
                            sx={{ flex: 1 }}
                          />
                          <Box
                            sx={{
                              width: 50,
                              height: 50,
                              bgcolor: settings.primary_color || '#1976d2',
                              borderRadius: 1,
                              border: '2px solid #ddd'
                            }}
                          />
                        </Box>
                      </Grid>
                      
                      <Grid size={{ xs: 12 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <TextField
                            label="Cor Secundária"
                            value={settings.secondary_color || '#dc004e'}
                            onChange={(e) => updateSetting('secondary_color', e.target.value)}
                            sx={{ flex: 1 }}
                          />
                          <Box
                            sx={{
                              width: 50,
                              height: 50,
                              bgcolor: settings.secondary_color || '#dc004e',
                              borderRadius: 1,
                              border: '2px solid #ddd'
                            }}
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 3, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Preview das Cores
                    </Typography>
                    <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                      <Button 
                        variant="contained" 
                        sx={{ 
                          bgcolor: settings.primary_color,
                          mr: 1,
                          mb: 1,
                          '&:hover': { 
                            bgcolor: settings.primary_color,
                            filter: 'brightness(0.9)'
                          }
                        }}
                      >
                        Cor Primária
                      </Button>
                      <Button 
                        variant="contained" 
                        sx={{ 
                          bgcolor: settings.secondary_color,
                          mb: 1,
                          '&:hover': { 
                            bgcolor: settings.secondary_color,
                            filter: 'brightness(0.9)'
                          }
                        }}
                      >
                        Cor Secundária
                      </Button>
                    </Box>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            {/* Tab 3: Horários de Funcionamento */}
            <TabPanel value={tabValue} index={2}>
              <Card sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <ScheduleIcon sx={{ mr: 1 }} />
                  Horários de Funcionamento
                </Typography>
                
                <Grid container spacing={2}>
                  {weekDays.map(day => (
                    <Grid size={{ xs: 12 }} key={day.key}>
                      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid size={{ xs: 12, sm: 3 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {day.label}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 6, sm: 2 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={!settings.opening_hours[day.key]?.closed}
                                  onChange={(e) => updateOpeningHour(day.key, 'closed', !e.target.checked)}
                                />
                              }
                              label="Aberto"
                            />
                          </Grid>
                          {!settings.opening_hours[day.key]?.closed && (
                            <>
                              <Grid size={{ xs: 6, sm: 3 }}>
                                <TextField
                                  type="time"
                                  label="Abertura"
                                  value={settings.opening_hours[day.key]?.open || '18:00'}
                                  onChange={(e) => updateOpeningHour(day.key, 'open', e.target.value)}
                                  fullWidth
                                  size="small"
                                />
                              </Grid>
                              <Grid size={{ xs: 6, sm: 3 }}>
                                <TextField
                                  type="time"
                                  label="Fechamento"
                                  value={settings.opening_hours[day.key]?.close || '23:00'}
                                  onChange={(e) => updateOpeningHour(day.key, 'close', e.target.value)}
                                  fullWidth
                                  size="small"
                                />
                              </Grid>
                            </>
                          )}
                        </Grid>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Card>
            </TabPanel>

            {/* Tab 4: Métodos de Pagamento */}
            <TabPanel value={tabValue} index={3}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                      Dinheiro
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.accepts_cash}
                          onChange={(e) => updateSetting('accepts_cash', e.target.checked)}
                          size="medium"
                        />
                      }
                      label={settings.accepts_cash ? 'Aceita' : 'Não aceita'}
                      labelPlacement="bottom"
                    />
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                      PIX
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.accepts_pix}
                          onChange={(e) => updateSetting('accepts_pix', e.target.checked)}
                          size="medium"
                        />
                      }
                      label={settings.accepts_pix ? 'Aceita' : 'Não aceita'}
                      labelPlacement="bottom"
                    />
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                      Cartão
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.accepts_card}
                          onChange={(e) => updateSetting('accepts_card', e.target.checked)}
                          size="medium"
                        />
                      }
                      label={settings.accepts_card ? 'Aceita' : 'Não aceita'}
                      labelPlacement="bottom"
                    />
                  </Card>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="h6" gutterBottom>
                    Modalidades de Atendimento
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                      Delivery
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.delivery_available}
                          onChange={(e) => updateSetting('delivery_available', e.target.checked)}
                          size="medium"
                        />
                      }
                      label={settings.delivery_available ? 'Disponível' : 'Indisponível'}
                      labelPlacement="bottom"
                    />
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                      Retirada
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.takeaway_available}
                          onChange={(e) => updateSetting('takeaway_available', e.target.checked)}
                          size="medium"
                        />
                      }
                      label={settings.takeaway_available ? 'Disponível' : 'Indisponível'}
                      labelPlacement="bottom"
                    />
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>
          </Card>
        </motion.div>
      </Container>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
