import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  CircularProgress, 
  Box, 
  Snackbar, 
  Alert, 
  Paper,
  IconButton,
  Divider,
  Badge,
  Tooltip,
  useTheme
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SendIcon from '@mui/icons-material/Send';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type MenuItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
};

type Table = {
  id: number;
  number: number;
  status: 'available' | 'occupied' | 'reserved';
};

export default function MenuPage() {
  const router = useRouter();
  const { table } = router.query;
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<{ [key: number]: number }>({});
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error' | 'info' | 'warning'}>({open: false, message: '', severity: 'info'});
  const [submitting, setSubmitting] = useState(false);
  const theme = useTheme();

  // Buscar itens do menu
  const fetchMenu = useCallback(async () => {
    try {
      console.log('Buscando itens do menu...');
      setLoading(true);
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('name');
        
      if (error) {
        console.error('Erro ao buscar menu:', error);
        setSnackbar({open: true, message: `Erro ao carregar cardápio: ${error.message}`, severity: 'error'});
        return;
      }
      
      if (data) {
        console.log(`${data.length} itens encontrados no cardápio`);
        setMenu(data);
      }
    } catch (e) {
      console.error('Exceção ao buscar menu:', e);
      setSnackbar({open: true, message: `Erro inesperado: ${e}`, severity: 'error'});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Adicionar item ao pedido
  const handleAdd = (id: number) => {
    setOrder((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };
  
  // Remover item do pedido
  const handleRemove = (id: number) => {
    setOrder((prev) => {
      const next = { ...prev };
      if (next[id] > 0) next[id] -= 1;
      if (next[id] === 0) delete next[id]; // Remover item se quantidade for zero
      return next;
    });
  };
  
  // Fechar snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({...snackbar, open: false});
  };
  
  // Calcular total de itens no carrinho
  const getTotalItems = () => {
    return Object.values(order).reduce((sum, quantity) => sum + quantity, 0);
  };
  
  // Calcular valor total do pedido
  const getTotalPrice = () => {
    return Object.entries(order).reduce((total, [itemId, quantity]) => {
      const menuItem = menu.find(item => item.id === Number(itemId));
      return total + (menuItem ? menuItem.price * quantity : 0);
    }, 0);
  };

  // Enviar pedido para a cozinha
  const handleSubmit = async () => {
    try {
      // Verificar se há itens no pedido
      if (getTotalItems() === 0) {
        setSnackbar({open: true, message: 'Adicione pelo menos um item ao pedido', severity: 'warning'});
        return;
      }
      
      // Verificar se a mesa foi identificada
      if (!table) {
        setSnackbar({open: true, message: 'Mesa não identificada!', severity: 'error'});
        return;
      }
      
      setSubmitting(true);
      console.log(`Enviando pedido para a mesa ${table}...`);
      
      // Buscar ID da mesa
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('id, number')
        .eq('number', table)
        .single() as { data: Table | null, error: any };
        
      if (tableError || !tableData) {
        console.error('Erro ao buscar mesa:', tableError);
        setSnackbar({open: true, message: 'Mesa inválida!', severity: 'error'});
        setSubmitting(false);
        return;
      }
      
      // Filtrar apenas itens com quantidade > 0
      const items = Object.entries(order).filter(([_, q]) => q > 0);
      if (items.length === 0) {
        setSnackbar({open: true, message: 'Adicione pelo menos um item ao pedido', severity: 'warning'});
        setSubmitting(false);
        return;
      }
      
      // Calcular o preço total do pedido
      const totalPrice = getTotalPrice();
      console.log(`Total do pedido: R$ ${totalPrice.toFixed(2)}`);
      
      // Criar o pedido com o preço total
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: tableData.id,
          status: 'pending',
          total: totalPrice,
          created_at: new Date().toISOString() // Adicionar timestamp explícito
        })
        .select()
        .single();
        
      if (orderError) {
        console.error('Erro ao criar pedido:', orderError);
        setSnackbar({open: true, message: `Erro ao criar pedido: ${orderError.message}`, severity: 'error'});
        setSubmitting(false);
        return;
      }
      
      if (!orderData) {
        console.error('Pedido criado, mas sem dados retornados');
        setSnackbar({open: true, message: 'Erro ao criar pedido: sem dados retornados', severity: 'error'});
        setSubmitting(false);
        return;
      }
      
      console.log(`Pedido ${orderData.id} criado com sucesso. Adicionando itens...`);
      
      // Adicionar os itens do pedido
      const orderItemPromises = items.map(async ([menu_item_id, quantity]) => {
        const { error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: orderData.id,
            menu_item_id: Number(menu_item_id),
            quantity
          });
          
        if (itemError) {
          console.error(`Erro ao adicionar item ${menu_item_id} ao pedido:`, itemError);
          return false;
        }
        return true;
      });
      
      // Aguardar todas as inserções de itens
      const results = await Promise.all(orderItemPromises);
      
      // Atualizar o status da mesa para 'occupied'
      const { error: tableUpdateError } = await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', tableData.id);
        
      if (tableUpdateError) {
        console.error('Erro ao atualizar status da mesa:', tableUpdateError);
        // Não interromper o fluxo, apenas registrar o erro
      } else {
        console.log(`Mesa ${table} marcada como ocupada`);
      }
      
      if (results.some(result => !result)) {
        setSnackbar({open: true, message: 'Alguns itens não puderam ser adicionados ao pedido', severity: 'warning'});
      } else {
        console.log('Todos os itens adicionados com sucesso');
        setSnackbar({open: true, message: 'Pedido enviado para a cozinha!', severity: 'success'});
        setOrder({}); // Limpar o carrinho
      }
    } catch (e) {
      console.error('Exceção ao enviar pedido:', e);
      setSnackbar({open: true, message: `Erro inesperado: ${e}`, severity: 'error'});
    } finally {
      setSubmitting(false);
    }
  };

  // Renderização durante carregamento
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      background: theme.palette.grey[50], 
      pb: 8 
    }}>
      {/* Cabeçalho */}
      <Paper 
        elevation={2} 
        sx={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 10, 
          p: 2, 
          mb: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderRadius: 0
        }}
      >
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          Cardápio - Mesa {table}
        </Typography>
        <Badge 
          badgeContent={getTotalItems()} 
          color="primary" 
          showZero={false}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.8rem', fontWeight: 'bold' } }}
        >
          <ShoppingCartIcon color="primary" />
        </Badge>
      </Paper>

      <Container maxWidth="lg" sx={{ flex: 1 }}>
        {/* Categorias e itens do menu */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {menu.map((item) => (
            <Box key={item.id} sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 10.667px)' } }}>
              <Card elevation={2} sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[4]
                }
              }}>
                {/* Imagem do item */}
                {item.image_url ? (
                  <Box 
                    sx={{ 
                      height: 180, 
                      backgroundImage: `url(${item.image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }} 
                    aria-label={item.name}
                  />
                ) : (
                  <Box 
                    sx={{ 
                      height: 180, 
                      backgroundColor: theme.palette.grey[200],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Typography variant="body2" color="textSecondary">
                      Sem imagem
                    </Typography>
                  </Box>
                )}
                
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {item.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    {item.description}
                  </Typography>
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                    R$ {item.price.toFixed(2)}
                  </Typography>
                </CardContent>
                
                <Divider />
                
                {/* Controles de quantidade */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  p: 1
                }}>
                  <Tooltip title="Remover do pedido">
                    <span>
                      <IconButton 
                        onClick={() => handleRemove(item.id)} 
                        disabled={!order[item.id]}
                        color="primary"
                        size="small"
                      >
                        <RemoveIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  
                  <Typography variant="body1" sx={{ 
                    fontWeight: 'bold',
                    minWidth: '30px',
                    textAlign: 'center'
                  }}>
                    {order[item.id] || 0}
                  </Typography>
                  
                  <Tooltip title="Adicionar ao pedido">
                    <IconButton 
                      onClick={() => handleAdd(item.id)} 
                      color="primary"
                      size="small"
                    >
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Card>
            </Box>
          ))}
        </Box>

        {/* Resumo do pedido e botão de envio */}
        {getTotalItems() > 0 && (
          <Paper 
            elevation={3} 
            sx={{ 
              position: 'fixed', 
              bottom: 0, 
              left: 0, 
              right: 0, 
              p: 2,
              zIndex: 10,
              borderRadius: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: theme.palette.background.paper
            }}
          >
            <Box>
              <Typography variant="subtitle1">
                {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'itens'}
              </Typography>
              <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                Total: R$ {getTotalPrice().toFixed(2)}
              </Typography>
            </Box>
            
            <Button 
              variant="contained" 
              color="primary" 
              size="large"
              disabled={submitting || getTotalItems() === 0}
              onClick={handleSubmit}
              startIcon={<SendIcon />}
              sx={{ borderRadius: '24px', px: 3 }}
            >
              {submitting ? 'Enviando...' : 'Enviar Pedido'}
            </Button>
          </Paper>
        )}
      </Container>
      
      {/* Snackbar para feedback */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
