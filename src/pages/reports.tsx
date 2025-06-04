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
    table_number: number;
    orders: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    table_number: number;
    total_amount: number;
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

  useEffect(() => {
    loadStats();
  }, [dateRange, startDate, endDate]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Calcular datas baseado no filtro
      let whereClause = '';
      const today = new Date();
      
      switch (dateRange) {
        case 'today':
          whereClause = `DATE(created_at) = CURRENT_DATE`;
          break;
        case 'week':
          whereClause = `created_at >= CURRENT_DATE - INTERVAL '7 days'`;
          break;
        case 'month':
          whereClause = `created_at >= CURRENT_DATE - INTERVAL '30 days'`;
          break;
        case 'custom':
          if (startDate && endDate) {
            whereClause = `DATE(created_at) BETWEEN '${startDate}' AND '${endDate}'`;
          } else {
            whereClause = `DATE(created_at) = CURRENT_DATE`;
          }
          break;
        default:
          whereClause = `DATE(created_at) = CURRENT_DATE`;
      }

      // Buscar estatísticas gerais
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .or(`status.eq.completed,status.eq.paid`)
        .order('created_at', { ascending: false });

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

      // Buscar itens dos pedidos
      const orderIds = filteredOrders.map(order => order.id);
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          *,
          menu_items (name, price)
        `)
        .in('order_id', orderIds);

      // Buscar adicionais
      const orderItemIds = orderItems?.map(item => item.id) || [];
      const { data: orderAddons } = await supabase
        .from('order_item_addons')
        .select(`
          *,
          addon_name,
          addon_price
        `)
        .in('order_item_id', orderItemIds);

      // Calcular estatísticas
      const totalOrders = filteredOrders.length;
      const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const totalItems = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const totalTables = new Set(filteredOrders.map(order => order.table_number)).size;

      // Itens mais populares
      const itemStats = {};
      orderItems?.forEach(item => {
        const itemName = item.menu_items?.name || 'Item Desconhecido';
        if (!itemStats[itemName]) {
          itemStats[itemName] = { quantity: 0, revenue: 0 };
        }
        itemStats[itemName].quantity += item.quantity;
        itemStats[itemName].revenue += item.quantity * (item.menu_items?.price || 0);
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
      orderAddons?.forEach(addon => {
        const addonName = addon.addon_name || 'Adicional Desconhecido';
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

      // Pedidos por hora
      const hourStats = {};
      for (let i = 0; i < 24; i++) {
        hourStats[i] = { orders: 0, revenue: 0 };
      }

      filteredOrders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourStats[hour].orders += 1;
        hourStats[hour].revenue += order.total_amount;
      });

      const ordersPerHour = Object.entries(hourStats).map(([hour, stats]: [string, any]) => ({
        hour: `${hour}:00`,
        orders: stats.orders,
        revenue: stats.revenue
      }));

      // Pedidos por dia (últimos 7 dias)
      const dayStats = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dayStats[dateStr] = { orders: 0, revenue: 0 };
      }

      filteredOrders.forEach(order => {
        const dateStr = order.created_at.split('T')[0];
        if (dayStats[dateStr]) {
          dayStats[dateStr].orders += 1;
          dayStats[dateStr].revenue += order.total_amount;
        }
      });

      const ordersPerDay = Object.entries(dayStats).map(([date, stats]: [string, any]) => ({
        date: new Date(date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
        orders: stats.orders,
        revenue: stats.revenue
      }));

      // Uso das mesas
      const tableStats = {};
      filteredOrders.forEach(order => {
        const tableNumber = order.table_number;
        if (!tableStats[tableNumber]) {
          tableStats[tableNumber] = { orders: 0, revenue: 0 };
        }
        tableStats[tableNumber].orders += 1;
        tableStats[tableNumber].revenue += order.total_amount;
      });

      const tableUsage = Object.entries(tableStats)
        .map(([table, stats]: [string, any]) => ({
          table_number: parseInt(table),
          orders: stats.orders,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.orders - a.orders);

      // Pedidos recentes
      const recentOrders = filteredOrders.slice(0, 50).map(order => {
        const itemsCount = orderItems?.filter(item => item.order_id === order.id).length || 0;
        return {
          id: order.id,
          table_number: order.table_number,
          total_amount: order.total_amount,
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
      'Valor Total': order.total_amount,
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
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

        {/* Cards de Estatísticas */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
                color: 'white',
                height: 120
              }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <RestaurantIcon sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold">
                    {stats?.totalOrders || 0}
                  </Typography>
                  <Typography variant="body2">
                    Total de Pedidos
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #4ecdc4, #44a08d)',
                color: 'white',
                height: 120
              }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <AttachMoneyIcon sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold">
                    {formatCurrency(stats?.totalRevenue || 0)}
                  </Typography>
                  <Typography variant="body2">
                    Receita Total
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #45b7d1, #96c93d)',
                color: 'white',
                height: 120
              }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <TrendingUpIcon sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold">
                    {formatCurrency(stats?.averageOrderValue || 0)}
                  </Typography>
                  <Typography variant="body2">
                    Ticket Médio
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                color: 'white',
                height: 120
              }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <RestaurantIcon sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold">
                    {stats?.totalItems || 0}
                  </Typography>
                  <Typography variant="body2">
                    Itens Vendidos
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #a8edea, #fed6e3)',
                color: '#333',
                height: 120
              }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <TableBarIcon sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold">
                    {stats?.totalTables || 0}
                  </Typography>
                  <Typography variant="body2">
                    Mesas Ativas
                  </Typography>
                </CardContent>
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
                        <Recharts.Line type="monotone" dataKey="orders" stroke="#8884d8" name="Pedidos" />
                        <Recharts.Line type="monotone" dataKey="revenue" stroke="#82ca9d" name="Receita" />
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
                        <Recharts.Bar dataKey="orders" fill="#8884d8" name="Pedidos" />
                        <Recharts.Bar dataKey="revenue" fill="#82ca9d" name="Receita" />
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
                        <Recharts.Bar dataKey="quantity" fill="#ff6b6b" name="Quantidade" />
                        <Recharts.Bar dataKey="revenue" fill="#4ecdc4" name="Receita" />
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
                          {stats?.popularItems?.slice(0, 10).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell align="right">{item.quantity}</TableCell>
                              <TableCell align="right">{formatCurrency(item.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Adicionais Mais Populares
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Adicional</TableCell>
                            <TableCell align="right">Quantidade</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stats?.popularAddons?.slice(0, 10).map((addon, index) => (
                            <TableRow key={index}>
                              <TableCell>{addon.name}</TableCell>
                              <TableCell align="right">{addon.quantity}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
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
                      {stats?.tableUsage?.map((table, index) => (
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
              </Card>
            </TabPanel>

            {/* Tab 4: Pedidos */}
            <TabPanel value={tabValue} index={3}>
              <Card sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Pedidos Recentes
                </Typography>
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
                      {stats?.recentOrders
                        ?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {order.id.slice(0, 8)}...
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={`Mesa ${order.table_number}`} size="small" />
                          </TableCell>
                          <TableCell>{order.items_count} itens</TableCell>
                          <TableCell align="right">
                            {formatCurrency(order.total_amount)}
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
                  count={stats?.recentOrders?.length || 0}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="Itens por página:"
                  labelDisplayedRows={({ from, to, count }) => 
                    `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
                  }
                />
              </Card>
            </TabPanel>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
