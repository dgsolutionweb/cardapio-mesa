-- Migração para adicionar controles de exibição de adicionais e variações
-- Execute este SQL no seu painel do Supabase

-- Adicionar colunas para controlar exibição de adicionais e variações
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS show_addons BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_size_variants BOOLEAN DEFAULT false;

-- Atualizar comentários das colunas
COMMENT ON COLUMN menu_items.show_addons IS 'Controla se o produto deve mostrar opções de adicionais para o cliente';
COMMENT ON COLUMN menu_items.show_size_variants IS 'Controla se o produto deve mostrar opções de variações de tamanho para o cliente';

-- Exemplo: Atualizar alguns produtos existentes para mostrar adicionais (opcional)
-- UPDATE menu_items SET show_addons = true WHERE name ILIKE '%hambúrguer%' OR name ILIKE '%pizza%';
-- UPDATE menu_items SET show_size_variants = true WHERE name ILIKE '%pizza%' OR name ILIKE '%refrigerante%';
