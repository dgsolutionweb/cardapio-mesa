import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Container, Typography, Paper, List, ListItem, ListItemText, Divider, 
  CircularProgress, Box, Grid, Card, CardContent, CardActions, Button, 
  Chip, IconButton, AppBar, Toolbar, Badge, Tooltip, useTheme, useMediaQuery,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useReactToPrint } from 'react-to-print';
import '@fontsource/inter/400.css';
import '@fontsource/roboto-flex/400.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type KitchenOrder = {
  id: number;
  table_id: number;
  status: string;
  created_at: string;
  items: { 
    id: number; 
    name: string; 
    quantity: number; 
    notes?: string;
    addons?: { id: number, name: string, price: number }[];
    size_variant?: { id: number, size_name: string, price_modifier: number };
  }[];
  total?: number;
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error' | 'info'}>(
    {open: false, message: '', severity: 'success'}
  );
  const [newOrderNotification, setNewOrderNotification] = useState(false);
  const printComponentRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const fetchOrders = async () => {
    setLoading(true);
    try {
      console.log('Iniciando busca de pedidos...');
      
      // Buscar diretamente apenas os pedidos pendentes ou em preparo
      // Otimização: Usar filtro no servidor em vez de buscar todos e filtrar no cliente
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['pending', 'preparing'])
        .order('created_at', { ascending: false }); // Mais recentes primeiro
        
      console.log('Pedidos pendentes/em preparo:', { ordersData, ordersError });
      
      if (ordersError) {
        console.error('Erro ao buscar pedidos:', ordersError);
        setSnackbar({open: true, message: `Erro ao buscar pedidos: ${ordersError.message}`, severity: 'error'});
        setLoading(false);
        return;
      }
      
      if (!ordersData || ordersData.length === 0) {
        console.log('Nenhum pedido pendente encontrado');
        setOrders([]);
        setLoading(false);
        return;
      }
      
      console.log(`Encontrados ${ordersData.length} pedidos pendentes/em preparo`);
      
      // Armazenar o número atual de pedidos para verificar se há novos
      const prevOrdersCount = orders.length;
      const mappedOrders = [];
      
      // Buscar todos os itens de pedidos de uma vez para reduzir o número de requisições
      const orderIds = ordersData.map(order => order.id);
      
      // Buscar todos os itens de todos os pedidos de uma vez
      const { data: allOrderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);
        
      if (orderItemsError) {
        console.error('Erro ao buscar itens dos pedidos:', orderItemsError);
        setSnackbar({open: true, message: `Erro ao buscar itens: ${orderItemsError.message}`, severity: 'error'});
      }
      
      console.log('Todos os itens de pedidos:', allOrderItems);
      
      // Coletar todos os IDs de itens do menu para buscar de uma vez
      const menuItemIds = allOrderItems
        ? [...new Set(allOrderItems.map(item => item.menu_item_id).filter(Boolean))]
        : [];
      
      // Buscar todos os itens do menu de uma vez
      let menuItemsData: any[] = [];
      if (menuItemIds.length > 0) {
        const { data: menuItems, error: menuItemsError } = await supabase
          .from('menu_items')
          .select('*')
          .in('id', menuItemIds);
          
        if (menuItemsError) {
          console.error('Erro ao buscar itens do menu:', menuItemsError);
        } else if (menuItems) {
          menuItemsData = menuItems;
          console.log('Itens do menu encontrados:', menuItemsData.length);
        }
      }
      
      // Buscar todos os adicionais dos itens dos pedidos
      let orderItemAddonMap: Record<number, { id: number, name: string, price: number }[]> = {};
      if (allOrderItems && allOrderItems.length > 0) {
        const orderItemIds = allOrderItems.map(item => item.id);
        console.log('IDs dos itens do pedido para buscar adicionais:', orderItemIds);
        
        const { data: orderItemAddons, error: addonsError } = await supabase
          .from('order_item_addons')
          .select('order_item_id, addon_id, addon_name, addon_price')
          .in('order_item_id', orderItemIds);
          
        console.log('Resultado da busca de adicionais:', { orderItemAddons, addonsError });
          
        if (addonsError) {
          console.error('Erro ao buscar adicionais dos itens:', addonsError);
        } else if (orderItemAddons && orderItemAddons.length > 0) {
          console.log('Adicionais de itens encontrados:', orderItemAddons.length);
          // Criar mapa de item_id -> [addons]
          for (const oia of orderItemAddons) {
            if (!orderItemAddonMap[oia.order_item_id]) {
              orderItemAddonMap[oia.order_item_id] = [];
            }
            orderItemAddonMap[oia.order_item_id].push({
              id: oia.addon_id,
              name: oia.addon_name,
              price: oia.addon_price
            });
          }
        } else {
          console.log('Nenhum adicional encontrado para os itens:', orderItemIds);
        }
      }
      
      // Buscar todas as variações de tamanho de uma vez
      let sizeVariantsData: any[] = [];
      const { data: sizeVariants, error: sizeVariantsError } = await supabase
        .from('size_variants')
        .select('*');
        
      if (sizeVariantsError) {
        console.error('Erro ao buscar variações de tamanho:', sizeVariantsError);
      } else if (sizeVariants) {
        sizeVariantsData = sizeVariants;
        console.log('Variações de tamanho encontradas:', sizeVariantsData.length);
      }
      
      // Processar cada pedido
      for (const order of ordersData) {
        // Filtrar os itens deste pedido
        const orderItems = allOrderItems
          ? allOrderItems.filter(item => item.order_id === order.id)
          : [];
        
        // Mapear os itens do pedido com informações do menu
        const items = orderItems.map(item => {
          const menuItem = menuItemsData.find(mi => mi.id === item.menu_item_id);
          
          // Obter adicionais deste item (já com os dados completos)
          const itemAddons = orderItemAddonMap[item.id] || [];
          
          // Obter variação de tamanho
          let sizeVariant = null;
          if (item.size_variant_id) {
            const sv = sizeVariantsData.find(sv => sv.id === item.size_variant_id);
            if (sv) {
              sizeVariant = {
                id: sv.id,
                size_name: sv.size_name,
                price_modifier: sv.price_modifier
              };
            }
          }
          
          return {
            id: item.id,
            name: menuItem?.name || `Item #${item.menu_item_id}`,
            quantity: item.quantity,
            notes: item.notes,
            addons: itemAddons.length > 0 ? itemAddons : undefined,
            size_variant: sizeVariant
          };
        });
        
        // Adicionar o pedido completo à lista
        mappedOrders.push({
          id: order.id,
          table_id: order.table_id,
          status: order.status,
          created_at: order.created_at,
          total: typeof order.total === 'number' ? order.total : parseFloat(order.total) || 0,
          items: items
        });
      }
      
      // Atualizar o estado com os pedidos processados
      setOrders(mappedOrders);
      
      // Notificar sobre novos pedidos
      if (mappedOrders.length > prevOrdersCount) {
        console.log(`Novos pedidos detectados! Anterior: ${prevOrdersCount}, Atual: ${mappedOrders.length}`);
        setNewOrderNotification(true);
        
        // Tocar som de notificação
        try {
          const audio = new Audio('/notification.mp3');
          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => console.log('Notificação sonora reproduzida com sucesso'))
              .catch(e => {
                console.error('Erro ao tocar notificação:', e);
                // Tentar reproduzir novamente com interação do usuário
                setSnackbar({
                  open: true, 
                  message: 'Novo pedido recebido! Clique para ativar som.', 
                  severity: 'info'
                });
              });
          }
        } catch (e) {
          console.error('Exceção ao tocar som de notificação:', e);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      setSnackbar({open: true, message: `Erro inesperado: ${error}`, severity: 'error'});
    } finally {
      setLoading(false);
    }
  };

  // Atualização manual de pedidos
  const handleRefresh = () => {
    console.log('Atualizando pedidos manualmente...');
    setSnackbar({open: true, message: 'Atualizando pedidos...', severity: 'info'});
    fetchOrders();
  };

  // Limpar notificação de novo pedido
  const clearNotification = () => {
    console.log('Limpando notificação de novo pedido');
    setNewOrderNotification(false);
    
    // Tentar tocar som de notificação novamente (após interação do usuário)
    try {
      const audio = new Audio('/notification.mp3');
      audio.play()
        .then(() => console.log('Notificação sonora reproduzida após interação'))
        .catch(e => console.error('Ainda não foi possível reproduzir o som:', e));
    } catch (e) {
      console.error('Exceção ao tocar som após interação:', e);
    }
  };

  // Verificar se o navegador suporta notificações
  const checkNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações desktop');
      return;
    }

    if (Notification.permission === 'granted') {
      console.log('Permissão para notificações já concedida');
    } else if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        console.log(`Permissão para notificações: ${permission}`);
      } catch (e) {
        console.error('Erro ao solicitar permissão para notificações:', e);
      }
    }
  };

  // Pré-carregar o som de notificação
  useEffect(() => {
    // Pré-carregar o áudio para evitar problemas de reprodução
    const preloadAudio = new Audio('/notification.mp3');
    preloadAudio.load();
    
    // Verificar permissões de notificação
    checkNotificationPermission();
  }, []);

  useEffect(() => {
    // Buscar pedidos ao carregar a página
    fetchOrders();
    
    // Configurar atualização automática a cada 20 segundos (reduzido para detectar mudanças mais rapidamente)
    const interval = setInterval(fetchOrders, 20000);
    
    // Configurar subscription para atualizações em tempo real
    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        console.log('Novo pedido detectado:', payload);
        // Forçar notificação para novos pedidos
        setNewOrderNotification(true);
        fetchOrders();
        
        // Tentar mostrar notificação desktop
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Novo Pedido!', {
              body: 'Um novo pedido foi recebido na cozinha.',
              icon: '/favicon.ico'
            });
          } catch (e) {
            console.error('Erro ao mostrar notificação desktop:', e);
          }
        }
        
        // Tentar tocar som
        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(e => console.error('Erro ao tocar som de notificação:', e));
        } catch (e) {
          console.error('Exceção ao tocar som:', e);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        console.log('Pedido atualizado:', payload);
        fetchOrders();
      })
      .subscribe();

    // Subscription para itens de pedidos
    const orderItemsChannel = supabase
      .channel('order-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, payload => {
        console.log('Mudança detectada em order_items:', payload);
        fetchOrders();
      })
      .subscribe();
      
    return () => { 
      // Limpar recursos ao desmontar o componente
      clearInterval(interval);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(orderItemsChannel);
    };
  }, []);

  // Função para atualizar o status de um pedido
  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      // Convertendo 'completed' para 'ready' na cozinha
      // 'ready' significa que o pedido está pronto para ser servido, mas não foi pago ainda
      // 'completed' só será usado pelo admin quando o pagamento for feito
      const newStatus = status === 'completed' ? 'ready' : status;
      
      console.log(`Atualizando pedido ${orderId} para status ${newStatus}...`);
      setLoading(true);
      
      // Verificar se o pedido existe antes de atualizar
      const { data: orderExists, error: checkError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .single();
      
      if (checkError || !orderExists) {
        console.error('Erro ao verificar pedido:', checkError);
        setSnackbar({open: true, message: 'Pedido não encontrado', severity: 'error'});
        setLoading(false);
        return;
      }
      
      // Atualizar o status do pedido
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          // Não enviar updated_at, deixar o Supabase gerenciar isso
        })
        .eq('id', orderId);
      
      if (error) {
        console.error('Erro ao atualizar pedido:', error);
        setSnackbar({open: true, message: `Erro ao atualizar pedido: ${error.message}`, severity: 'error'});
      } else {
        console.log(`Pedido ${orderId} atualizado com sucesso para ${newStatus}`);
        setSnackbar({
          open: true, 
          message: newStatus === 'preparing' ? 'Pedido em preparo!' : 'Pedido pronto para servir!', 
          severity: 'success'
        });
        // Atualizar a lista de pedidos
        fetchOrders();
      }
    } catch (e) {
      console.error('Exceção ao atualizar pedido:', e);
      setSnackbar({open: true, message: `Erro inesperado: ${e}`, severity: 'error'});
    } finally {
      setLoading(false);
    }
  };
  
  // Configuração da impressão usando a versão 3.1.0 do react-to-print
  const handlePrint = useReactToPrint({
    documentTitle: 'Comanda',
    contentRef: printComponentRef,
    onAfterPrint: () => {
      console.log('Impressão concluída com sucesso');
      setPrintDialogOpen(false);
      setSnackbar({open: true, message: 'Comanda impressa com sucesso!', severity: 'success'});
    },
    onPrintError: (errorLocation, error) => {
      console.error(`Erro ao imprimir (${errorLocation}):`, error);
      setSnackbar({open: true, message: `Erro ao imprimir: ${error.message}`, severity: 'error'});
    },
    // Adiciona estilo personalizado para a página de impressão
    pageStyle: `
      @media print {
        @page { size: 80mm auto; margin: 0mm; }
        body { margin: 10mm 5mm; }
      }
    `
  });
  
  const openPrintDialog = (order: KitchenOrder) => {
    console.log('Abrindo diálogo de impressão para pedido:', order);
    // Garantir que o pedido tenha todas as informações necessárias
    if (!order.items || order.items.length === 0) {
      setSnackbar({open: true, message: 'Pedido sem itens para imprimir', severity: 'error'});
      return;
    }
    setSelectedOrder(order);
    setPrintDialogOpen(true);
    // Pequeno atraso para garantir que o componente esteja renderizado antes de tentar imprimir
    setTimeout(() => {
      console.log('Componente de impressão pronto:', printComponentRef.current);
    }, 300);
  };
  
  // Formatar data e hora
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  // Calcular tempo decorrido desde a criação do pedido
  const getElapsedTime = (dateString: string) => {
    const created = new Date(dateString).getTime();
    const now = new Date().getTime();
    const diffMinutes = Math.floor((now - created) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes === 1) return '1 minuto';
    return `${diffMinutes} minutos`;
  };

  if (loading && orders.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: theme.palette.grey[50], fontFamily: 'Inter, Roboto Flex, sans-serif' }}>
      {/* AppBar */}
      <AppBar position="static" color="primary" sx={{ mb: 2 }}>
        <Toolbar>
          <RestaurantIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Cozinha
          </Typography>
          <Tooltip title="Atualizar pedidos">
            <IconButton color="inherit" onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={newOrderNotification ? "Novos pedidos!" : "Nenhum novo pedido"}>
            <Badge 
              badgeContent={newOrderNotification ? "!" : 0} 
              color="error"
              onClick={clearNotification}
              sx={{ 
                cursor: 'pointer',
                animation: newOrderNotification ? 'pulse 1.5s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.2)' },
                  '100%': { transform: 'scale(1)' }
                }
              }}
            >
              <NotificationsIcon color={newOrderNotification ? "error" : "inherit"} />
            </Badge>
          </Tooltip>
        </Toolbar>
      </AppBar>
      
      {/* Conteúdo principal */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, mt: 8 }}>
        <Grid container spacing={3} justifyContent="center">
          <Box sx={{ width: '100%', maxWidth: { md: '83.333%', lg: '75%' }, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                Pedidos Pendentes
              </Typography>
              <Chip 
                label={`${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}`} 
                color="primary" 
                variant="outlined"
              />
            </Box>
            
            {orders.length === 0 && !loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card sx={{ p: 4, borderRadius: 4, textAlign: 'center', boxShadow: 2 }}>
                  <CardContent>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Nenhum pedido pendente no momento
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Os novos pedidos aparecerão aqui automaticamente
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            <AnimatePresence>
              {orders.map((order) => (
                <motion.div 
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card 
                    sx={{ 
                      mb: 3, 
                      borderRadius: 3, 
                      overflow: 'visible',
                      boxShadow: 2,
                      border: order.status === 'pending' ? `1px solid ${theme.palette.warning.main}` : 
                             order.status === 'preparing' ? `1px solid ${theme.palette.info.main}` : 'none'
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          Mesa {order.table_id} - Pedido #{order.id}
                        </Typography>
                        <Chip 
                          icon={order.status === 'pending' ? <AccessTimeIcon /> : <CheckCircleIcon />}
                          label={order.status === 'pending' ? 'Pendente' : 'Em preparo'}
                          color={order.status === 'pending' ? 'warning' : 'info'}
                          size="small"
                        />
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        Recebido: {formatDateTime(order.created_at)} ({getElapsedTime(order.created_at)} atrás)
                      </Typography>
                      
                      <Divider sx={{ mb: 2 }} />
                      
                      <List dense disablePadding>
                        {order.items.map((item, idx) => (
                          <ListItem key={idx} disableGutters sx={{ py: 1 }}>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Typography variant="body1" component="span" sx={{ fontWeight: 600 }}>
                                    {item.quantity}x {item.name}
                                    {item.size_variant && (
                                      <Chip 
                                        label={item.size_variant.size_name} 
                                        size="small" 
                                        variant="outlined" 
                                        color="primary"
                                        sx={{ ml: 1, height: 20 }}
                                      />
                                    )}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                <>
                                  {item.notes && (
                                    <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                                      Obs: {item.notes}
                                    </Typography>
                                  )}
                                  {/* Adicionais */}
                                  {item.addons && item.addons.length > 0 && (
                                    <Box sx={{ mt: 0.5 }}>
                                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                        Adicionais:
                                      </Typography>
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                        {item.addons.map((addon: any, addonIndex: number) => (
                                          <Chip
                                            key={addonIndex}
                                            label={`${addon.name} (+R$ ${addon.price.toFixed(2)})`}
                                            size="small"
                                            variant="outlined"
                                            color="secondary"
                                          />
                                        ))}
                                      </Box>
                                    </Box>
                                  )}
                                </>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                    
                    <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0 }}>
                      <Button 
                        startIcon={<LocalPrintshopIcon />} 
                        onClick={() => openPrintDialog(order)}
                        variant="outlined"
                        size="small"
                      >
                        Imprimir
                      </Button>
                      
                      {order.status === 'pending' && (
                        <Button 
                          startIcon={<CheckCircleIcon />} 
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                          variant="contained" 
                          color="primary"
                          size="small"
                        >
                          Iniciar Preparo
                        </Button>
                      )}
                      
                      {order.status === 'preparing' && (
                        <Button 
                          startIcon={<DoneAllIcon />} 
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          variant="contained" 
                          color="success"
                          size="small"
                        >
                          Concluir
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>
        </Grid>
      </Box>
      
      {/* Dialog de impressão */}
      <Dialog open={printDialogOpen} onClose={() => setPrintDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Imprimir Comanda</DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box ref={printComponentRef} sx={{ p: 2 }}>
              <Typography variant="h6" align="center" gutterBottom>
                COMANDA - MESA {selectedOrder.table_id}
              </Typography>
              <Typography variant="body2" align="center" gutterBottom>
                Pedido #{selectedOrder.id} - {formatDateTime(selectedOrder.created_at)}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom>
                ITENS:
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                {selectedOrder.items.map((item, idx) => (
                  <Box key={idx} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {item.quantity}x {item.name}
                        {item.size_variant && ` (${item.size_variant.size_name})`}
                      </Typography>
                    </Box>
                    
                    {item.addons && item.addons.length > 0 && (
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', ml: 2 }}>
                        Adicionais: {item.addons.map(addon => addon.name).join(', ')}
                      </Typography>
                    )}
                    
                    {item.notes && (
                      <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.8rem', ml: 2 }}>
                        Obs: {item.notes}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">TOTAL:</Typography>
                <Typography variant="subtitle2">R$ {typeof selectedOrder.total === 'number' ? selectedOrder.total.toFixed(2) : '0.00'}</Typography>
              </Box>
              
              <Typography variant="caption" align="center" sx={{ display: 'block', mt: 4 }}>
                Obrigado pela preferência!
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintDialogOpen(false)}>Cancelar</Button>
          <Button 
            onClick={() => {
              console.log('Botão de impressão clicado');
              if (printComponentRef.current) {
                console.log('Referência do componente encontrada, iniciando impressão');
                handlePrint();
              } else {
                console.error('Referência do componente não encontrada');
                setSnackbar({open: true, message: 'Erro ao preparar impressão', severity: 'error'});
              }
            }} 
            variant="contained" 
            color="primary"
            startIcon={<LocalPrintshopIcon />}
            disabled={!selectedOrder}
          >
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar de feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({...s, open: false}))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
