# ============================================================================
# Transparência Política — comandos
# ---------------------------------------------------------------------------
# `make ajuda` lista o que dá para fazer.
# ============================================================================

.PHONY: ajuda instalar dados rodar smoke smoke-subpath paridade api-viva mapa build edge url limpar

PY      ?= python3
NODE    ?= node
PORT    ?= 8080
BASE    ?= http://localhost:$(PORT)

ajuda: ## Mostra esta ajuda
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

instalar: ## Cria o banco e popula com o dataset de demonstração
	$(NODE) app/tools/export-dataset.mjs
	$(PY) -m server.seed --reconstruir

dados: ## Reexporta o dataset e resemeia o banco
	$(NODE) app/tools/export-dataset.mjs
	$(PY) -m server.seed --reconstruir

rodar: ## Sobe o servidor (estáticos + API) na porta $(PORT)
	TP_PORT=$(PORT) $(PY) -m server.app

smoke: ## Varredura de todas as telas no navegador
	$(NODE) app/tools/smoke.mjs

smoke-subpath: ## A mesma varredura, com o app publicado em subdiretório
	$(NODE) app/tools/smoke.mjs --subpath

paridade: ## Confere que o banco e o front-end dizem a mesma coisa
	$(NODE) app/tools/confere-paridade.mjs

api-viva: ## Confere que a tela mostra o que está no banco
	$(NODE) app/tools/confere-api-viva.mjs

mapa: ## Regenera a geometria do mapa a partir do GeoJSON público
	$(PY) app/tools/build-map.py

build: ## Constrói a imagem de produção
	docker build -t transparenciapolicita:1.0.0 .

edge: ## Publica o proxy de borda e restringe a porta da VPS
	./deploy/publicar-edge.sh

url: ## Mostra o endereço público e confere se está de pé
	@echo "https://transparenciapolicita.luzempresarial.com.br"
	@curl -sS -m 30 -o /dev/null -w "home    %{http_code}\n" https://transparenciapolicita.luzempresarial.com.br/
	@curl -sS -m 30 -w "health  %{http_code}  " https://transparenciapolicita.luzempresarial.com.br/api/health; echo

limpar: ## Remove o banco local e as sobras de build
	rm -rf data/*.sqlite data/*.sqlite-shm data/*.sqlite-wal
	find . -name '__pycache__' -type d -prune -exec rm -rf {} +
