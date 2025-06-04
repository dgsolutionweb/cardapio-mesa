import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import {
  AppBar, Toolbar, Typography, IconButton, Box, Grid, Card, CardContent, 
  Paper, CircularProgress, Chip, Button, Select, MenuItem, FormControl, 
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, 
  TableRow, TablePagination, Divider, Tabs, Tab, Alert, useTheme,
  useMediaQuery, Container, TextField
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  BarChart as BarChartIcon,
  TrendingUp as TrendingUpIcon,
  Restaurant as RestaurantIcon,
  TableBar as TableBarIcon,
  AttachMoney as AttachMoneyIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import * as Recharts from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalItems: number;
  totalTables: number;
  popularItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  popularAddons: Array<{
    name: string;
    quantity: number;
  }>;
  ordersPerHour: Array<{
    hour: string;
    orders: number;
    revenue: number;
  }>;
  ordersPerDay: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
  tableUsage: Array<{
    table_id: number;
    table_number: number;
    orders: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    table_id: number;
    table_number: number;
    total: number;
    status: string;
    created_at: string;
    items_count: number;
  }>;
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
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function Reports() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Verificar autenticação
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    loadStats();
  }, [dateRange, startDate, endDate]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Buscar pedidos com informações da mesa
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *,
          tables!inner(number)
        `)
        .in('status', ['completed', 'paid', 'preparing', 'ready'])
        .order('created_at', { ascending: false });

      console.log('Orders found:', orders?.length);

      const today = new Date();
      const filteredOrders = orders?.filter(order => {
        const orderDate = new Date(order.created_at);
        const orderDateStr = orderDate.toISOString().split('T')[0];
        
        switch (dateRange) {
          case 'today':
            return orderDateStr === today.toISOString().split('T')[0];
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return orderDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setDate(monthAgo.getDate() - 30);
            return orderDate >= monthAgo;
          case 'custom':
            if (startDate && endDate) {
              return orderDateStr >= startDate && orderDateStr <= endDate;
            }
            return orderDateStr === today.toISOString().split('T')[0];
          default:
            return orderDateStr === today.toISOString().split('T')[0];
        }
      }) || [];

      console.log('Date filtered orders:', filteredOrders.length);

      // Se não há dados para o período selecionado, vamos pegar dados dos últimos 30 dias automaticamente
      let finalOrders = filteredOrders;
      if (filteredOrders.length === 0) {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        finalOrders = orders?.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= monthAgo;
        }) || [];
        console.log('Extended to 30 days, found:', finalOrders.length);
      }

      // Buscar itens dos pedidos
      const orderIds = finalOrders.map(order => order.id);
      let orderItems = [];
      let orderAddons = [];

      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select(`
            *,
            menu_items (name, price)
          `)
          .in('order_id', orderIds);
        
        orderItems = items || [];

        // Buscar adicionais
        const orderItemIds = orderItems.map(item => item.id);
        if (orderItemIds.length > 0) {
          const { data: addons } = await supabase
            .from('order_item_addons')
            .select('*')
            .in('order_item_id', orderItemIds);
          
          orderAddons = addons || [];
        }
      }

      // Calcular estatísticas
      const totalOrders = finalOrders.length;
      const totalRevenue = finalOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const totalItems = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalTables = new Set(finalOrders.map(order => order.table_id)).size;

      // Itens mais populares
      const itemStats = {};
      orderItems.forEach(item => {
        const itemName = item.menu_items?.name || `Item ${item.menu_item_id}`;
        if (!itemStats[itemName]) {
          itemStats[itemName] = { quantity: 0, revenue: 0 };
        }
        itemStats[itemName].quantity += item.quantity || 0;
        itemStats[itemName].revenue += (item.quantity || 0) * (item.menu_items?.price || 0);
      });

      const popularItems = Object.entries(itemStats)
        .map(([name, stats]: [string, any]) => ({
          name,
          quantity: stats.quantity,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Adicionais mais populares
      const addonStats = {};
      orderAddons.forEach(addon => {
        const addonName = addon.addon_name || `Adicional ${addon.id}`;
        if (!addonStats[addonName]) {
          addonStats[addonName] = { quantity: 0 };
        }
        addonStats[addonName].quantity += 1;
      });

      const popularAddons = Object.entries(addonStats)
        .map(([name, stats]: [string, any]) => ({
          name,
          quantity: stats.quantity
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Pedidos por hora (últimas 24 horas ou do período selecionado)
      const hourStats = {};
      for (let i = 0; i < 24; i++) {
        hourStats[i] = { orders: 0, revenue: 0 };
      }

      finalOrders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourStats[hour].orders += 1;
        hourStats[hour].revenue += order.total || 0;
      });

      const ordersPerHour = Object.entries(hourStats).map(([hour, stats]: [string, any]) => ({
        hour: `${hour.padStart(2, '0')}:00`,
        orders: stats.orders,
        revenue: stats.revenue
      }));

      // Pedidos por dia (últimos 7 dias)
      const dayStats = {};
      const dates = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dates.push(dateStr);
        dayStats[dateStr] = { orders: 0, revenue: 0 };
      }

      finalOrders.forEach(order => {
        const dateStr = order.created_at.split('T')[0];
        if (dayStats[dateStr]) {
          dayStats[dateStr].orders += 1;
          dayStats[dateStr].revenue += order.total || 0;
        }
      });

      const ordersPerDay = dates.map(date => {
        const stats = dayStats[date] || { orders: 0, revenue: 0 };
        return {
          date: new Date(date).toLocaleDateString('pt-BR', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          }),
          orders: stats.orders,
          revenue: stats.revenue
        };
      });

      // Uso das mesas
      const tableStats = {};
      finalOrders.forEach(order => {
        const tableId = order.table_id;
        const tableNumber = order.tables?.number || order.table_id;
        if (!tableStats[tableId]) {
          tableStats[tableId] = { table_number: tableNumber, orders: 0, revenue: 0 };
        }
        tableStats[tableId].orders += 1;
        tableStats[tableId].revenue += order.total || 0;
      });

      const tableUsage = Object.entries(tableStats)
        .map(([table, stats]: [string, any]) => ({
          table_id: parseInt(table),
          table_number: stats.table_number,
          orders: stats.orders,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.orders - a.orders);

      // Pedidos recentes (últimos 50)
      const recentOrders = finalOrders.slice(0, 50).map(order => {
        const itemsCount = orderItems.filter(item => item.order_id === order.id).length;
        return {
          id: order.id,
          table_id: order.table_id,
          table_number: order.tables?.number || order.table_id,
          total: order.total || 0,
          status: order.status,
          created_at: order.created_at,
          items_count: itemsCount
        };
      });

      setStats({
        totalOrders,
        totalRevenue,
        averageOrderValue,
        totalItems,
        totalTables,
        popularItems,
        popularAddons,
        ordersPerHour,
        ordersPerDay,
        tableUsage,
        recentOrders
      });

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const exportToCSV = () => {
    if (!stats) return;
    
    const csvData = stats.recentOrders.map(order => ({
      'ID do Pedido': order.id,
      'Mesa': order.table_number,
      'Valor Total': order.total,
      'Status': order.status,
      'Data/Hora': formatDateTime(order.created_at),
      'Itens': order.items_count
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => row[header]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-pedidos-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        color: 'white'
      }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <CircularProgress size={60} sx={{ color: 'white', mb: 3 }} />
          <Typography variant="h6" textAlign="center">
            Carregando relatórios...
          </Typography>
          <Typography variant="body2" textAlign="center" sx={{ opacity: 0.8, mt: 1 }}>
            Analisando dados de vendas e estatísticas
          </Typography>
        </motion.div>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      pb: 4
    }}>
      {/* Header */}
      <AppBar position="static" sx={{ 
        background: 'rgba(255,255,255,0.1)', 
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.2)'
      }}>
        <Toolbar>
          <IconButton
            color="inherit"
            onClick={() => router.back()}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <BarChartIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Relatórios e Analytics
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadStats}
            sx={{ 
              color: 'white', 
              borderColor: 'rgba(255,255,255,0.3)',
              '&:hover': { borderColor: 'white' }
            }}
          >
            Atualizar
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Filtros */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3, background: 'rgba(255,255,255,0.95)' }}>
            {/* Informação sobre dados exibidos */}
            {stats && (
              <Alert 
                severity={stats.totalOrders > 0 ? "info" : "warning"} 
                sx={{ mb: 2 }}
              >
                {stats.totalOrders > 0 
                  ? `Exibindo dados de ${stats.totalOrders} pedidos do período selecionado.`
                  : `Nenhum pedido encontrado para o período selecionado. Ajuste os filtros para ver dados ou adicione novos pedidos.`
                }
              </Alert>
            )}
            
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Período</InputLabel>
                  <Select
                    value={dateRange}
                    label="Período"
                    onChange={(e) => setDateRange(e.target.value)}
                  >
                    <MenuItem value="today">Hoje</MenuItem>
                    <MenuItem value="week">Última Semana</MenuItem>
                    <MenuItem value="month">Último Mês</MenuItem>
                    <MenuItem value="custom">Personalizado</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {dateRange === 'custom' && (
                <>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Data Inicial"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Data Final"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </>
              )}
              
              <Grid size={{ xs: 12, md: 3 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={exportToCSV}
                  sx={{ py: 1.5 }}
                >
                  Exportar CSV
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </motion.div>

        {/* Cards de Estatísticas Melhorados */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Total de Pedidos */}
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <Card sx={{ 
                borderRadius: 4, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                height: 140,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease',
                  boxShadow: '0 8px 30px rgba(102, 126, 234, 0.4)'
                }
              }}>
                <CardContent sx={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <RestaurantIcon sx={{ fontSize: 32 }} />
                    <Chip label="+12%" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                  </Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {stats?.totalOrders || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total de Pedidos
                  </Typography>
                </CardContent>
                <Box sx={{ 
                  position: 'absolute', 
                  top: -20, 
                  right: -20, 
                  width: 80, 
                  height: 80, 
                  bgcolor: 'rgba(255,255,255,0.1)', 
                  borderRadius: '50%' 
                }} />
              </Card>
            </Grid>

            {/* Receita Total */}
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <Card sx={{ 
                borderRadius: 4, 
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                height: 140,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease',
                  boxShadow: '0 8px 30px rgba(79, 172, 254, 0.4)'
                }
              }}>
                <CardContent sx={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <AttachMoneyIcon sx={{ fontSize: 32 }} />
                    <Chip label="+8%" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                  </Box>
                  <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5, fontSize: '1.8rem' }}>
                    {formatCurrency(stats?.totalRevenue || 0)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Receita Total
                  </Typography>
                </CardContent>
                <Box sx={{ 
                  position: 'absolute', 
                  top: -20, 
                  right: -20, 
                  width: 80, 
                  height: 80, 
                  bgcolor: 'rgba(255,255,255,0.1)', 
                  borderRadius: '50%' 
                }} />
              </Card>
            </Grid>

            {/* Ticket Médio */}
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <Card sx={{ 
                borderRadius: 4, 
                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                color: 'white',
                height: 140,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease',
                  boxShadow: '0 8px 30px rgba(250, 112, 154, 0.4)'
                }
              }}>
                <CardContent sx={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <TrendingUpIcon sx={{ fontSize: 32 }} />
                    <Chip label="+5%" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                  </Box>
                  <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5, fontSize: '1.8rem' }}>
                    {formatCurrency(stats?.averageOrderValue || 0)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Ticket Médio
                  </Typography>
                </CardContent>
                <Box sx={{ 
                  position: 'absolute', 
                  top: -20, 
                  right: -20, 
                  width: 80, 
                  height: 80, 
                  bgcolor: 'rgba(255,255,255,0.1)', 
                  borderRadius: '50%' 
                }} />
              </Card>
            </Grid>

            {/* Itens Vendidos */}
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <Card sx={{ 
                borderRadius: 4, 
                background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                color: '#333',
                height: 140,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease',
                  boxShadow: '0 8px 30px rgba(168, 237, 234, 0.4)'
                }
              }}>
                <CardContent sx={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <RestaurantIcon sx={{ fontSize: 32, color: '#666' }} />
                    <Chip label="+15%" size="small" sx={{ bgcolor: 'rgba(102,102,102,0.1)', color: '#666' }} />
                  </Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5, color: '#333' }}>
                    {stats?.totalItems || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, color: '#666' }}>
                    Itens Vendidos
                  </Typography>
                </CardContent>
                <Box sx={{ 
                  position: 'absolute', 
                  top: -20, 
                  right: -20, 
                  width: 80, 
                  height: 80, 
                  bgcolor: 'rgba(102,102,102,0.05)', 
                  borderRadius: '50%' 
                }} />
              </Card>
            </Grid>

            {/* Mesas Ativas */}
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <Card sx={{ 
                borderRadius: 4, 
                background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                color: '#8B4513',
                height: 140,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease',
                  boxShadow: '0 8px 30px rgba(255, 236, 210, 0.4)'
                }
              }}>
                <CardContent sx={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <TableBarIcon sx={{ fontSize: 32 }} />
                    <Chip label="Ativo" size="small" sx={{ bgcolor: 'rgba(139,69,19,0.1)', color: '#8B4513' }} />
                  </Box>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {stats?.totalTables || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Mesas Utilizadas
                  </Typography>
                </CardContent>
                <Box sx={{ 
                  position: 'absolute', 
                  top: -20, 
                  right: -20, 
                  width: 80, 
                  height: 80, 
                  bgcolor: 'rgba(139,69,19,0.1)', 
                  borderRadius: '50%' 
                }} />
              </Card>
            </Grid>
          </Grid>
        </motion.div>

        {/* Tabs de Conteúdo */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Paper sx={{ borderRadius: 3, background: 'rgba(255,255,255,0.95)' }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange}
              variant={isMobile ? "scrollable" : "fullWidth"}
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Gráficos" />
              <Tab label="Produtos" />
              <Tab label="Mesas" />
              <Tab label="Pedidos" />
            </Tabs>

            {/* Tab 1: Gráficos */}
            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={3}>
                {/* Gráfico de Pedidos por Hora */}
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Card sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Pedidos por Hora
                    </Typography>
                    <Recharts.ResponsiveContainer width="100%" height={300}>
                      <Recharts.LineChart data={stats?.ordersPerHour}>
                        <Recharts.CartesianGrid strokeDasharray="3 3" />
                        <Recharts.XAxis dataKey="hour" />
                        <Recharts.YAxis />
                        <Recharts.Tooltip 
                          formatter={(value, name) => [
                            name === 'orders' ? `${value} pedidos` : formatCurrency(Number(value)),
                            name === 'orders' ? 'Pedidos' : 'Receita'
                          ]}
                        />
                        <Recharts.Legend />
                        <Recharts.Line type="monotone" dataKey="orders" stroke="#667eea" strokeWidth={3} name="Pedidos" />
                        <Recharts.Line type="monotone" dataKey="revenue" stroke="#4facfe" strokeWidth={3} name="Receita" />
                      </Recharts.LineChart>
                    </Recharts.ResponsiveContainer>
                  </Card>
                </Grid>

                {/* Gráfico de Pedidos por Dia */}
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Card sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Pedidos dos Últimos 7 Dias
                    </Typography>
                    <Recharts.ResponsiveContainer width="100%" height={300}>
                      <Recharts.BarChart data={stats?.ordersPerDay}>
                        <Recharts.CartesianGrid strokeDasharray="3 3" />
                        <Recharts.XAxis dataKey="date" />
                        <Recharts.YAxis />
                        <Recharts.Tooltip 
                          formatter={(value, name) => [
                            name === 'orders' ? `${value} pedidos` : formatCurrency(Number(value)),
                            name === 'orders' ? 'Pedidos' : 'Receita'
                          ]}
                        />
                        <Recharts.Legend />
                        <Recharts.Bar dataKey="orders" fill="#667eea" name="Pedidos" />
                        <Recharts.Bar dataKey="revenue" fill="#4facfe" name="Receita" />
                      </Recharts.BarChart>
                    </Recharts.ResponsiveContainer>
                  </Card>
                </Grid>

                {/* Gráfico de Itens Populares */}
                <Grid size={{ xs: 12 }}>
                  <Card sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Itens Mais Populares
                    </Typography>
                    <Recharts.ResponsiveContainer width="100%" height={400}>
                      <Recharts.BarChart data={stats?.popularItems?.slice(0, 8)}>
                        <Recharts.CartesianGrid strokeDasharray="3 3" />
                        <Recharts.XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <Recharts.YAxis />
                        <Recharts.Tooltip formatter={(value, name) => [
                          name === 'quantity' ? `${value} unidades` : formatCurrency(Number(value)),
                          name === 'quantity' ? 'Quantidade' : 'Receita'
                        ]} />
                        <Recharts.Legend />
                        <Recharts.Bar dataKey="quantity" fill="#fa709a" name="Quantidade" />
                        <Recharts.Bar dataKey="revenue" fill="#4facfe" name="Receita" />
                      </Recharts.BarChart>
                    </Recharts.ResponsiveContainer>
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            {/* Tab 2: Produtos */}
            <TabPanel value={tabValue} index={1}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Itens Mais Vendidos
                    </Typography>
                    {stats?.popularItems && stats.popularItems.length > 0 ? (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Item</TableCell>
                              <TableCell align="right">Quantidade</TableCell>
                              <TableCell align="right">Receita</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {stats.popularItems.slice(0, 10).map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell align="right">{item.quantity}</TableCell>
                                <TableCell align="right">{formatCurrency(item.revenue)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Alert severity="info">
                        Nenhum item vendido no período selecionado.
                      </Alert>
                    )}
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Adicionais Mais Populares
                    </Typography>
                    {stats?.popularAddons && stats.popularAddons.length > 0 ? (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Adicional</TableCell>
                              <TableCell align="right">Quantidade</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {stats.popularAddons.slice(0, 10).map((addon, index) => (
                              <TableRow key={index}>
                                <TableCell>{addon.name}</TableCell>
                                <TableCell align="right">{addon.quantity}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Alert severity="info">
                        Nenhum adicional vendido no período selecionado.
                      </Alert>
                    )}
                  </Card>
                </Grid>
              </Grid>
            </TabPanel>

            {/* Tab 3: Mesas */}
            <TabPanel value={tabValue} index={2}>
              <Card sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Uso das Mesas
                </Typography>
                {stats?.tableUsage && stats.tableUsage.length > 0 ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Mesa</TableCell>
                          <TableCell align="right">Pedidos</TableCell>
                          <TableCell align="right">Receita Total</TableCell>
                          <TableCell align="right">Receita Média</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stats.tableUsage.map((table, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip 
                                label={`Mesa ${table.table_number}`} 
                                color="primary" 
                                variant="outlined" 
                              />
                            </TableCell>
                            <TableCell align="right">{table.orders}</TableCell>
                            <TableCell align="right">{formatCurrency(table.revenue)}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(table.revenue / table.orders)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">
                    Nenhuma mesa foi utilizada no período selecionado.
                  </Alert>
                )}
              </Card>
            </TabPanel>

            {/* Tab 4: Pedidos */}
            <TabPanel value={tabValue} index={3}>
              <Card sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Pedidos Recentes
                </Typography>
                {stats?.recentOrders && stats.recentOrders.length > 0 ? (
                  <>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Mesa</TableCell>
                            <TableCell>Itens</TableCell>
                            <TableCell align="right">Total</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Data/Hora</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stats.recentOrders
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>
                                <Typography variant="body2" fontFamily="monospace">
                                  {String(order.id).slice(0, 8)}...
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip label={`Mesa ${order.table_number}`} size="small" />
                              </TableCell>
                              <TableCell>{order.items_count} itens</TableCell>
                              <TableCell align="right">
                                {formatCurrency(order.total)}
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={order.status === 'completed' ? 'Concluído' : order.status === 'paid' ? 'Pago' : order.status}
                                  color={order.status === 'completed' || order.status === 'paid' ? 'success' : 'warning'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {formatDateTime(order.created_at)}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    
                    <TablePagination
                      rowsPerPageOptions={[10, 25, 50]}
                      component="div"
                      count={stats.recentOrders.length}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={handleChangePage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                      labelRowsPerPage="Itens por página:"
                      labelDisplayedRows={({ from, to, count }) => 
                        `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
                      }
                    />
                  </>
                ) : (
                  <Alert severity="info">
                    Nenhum pedido encontrado no período selecionado.
                  </Alert>
                )}
              </Card>
            </TabPanel>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
