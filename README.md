 Project Structure:

zomato-devops-project/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── nginx.conf
├── backend/
│   ├── api-gateway/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── restaurant-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── order-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── user-service/
│       ├── src/
│       ├── Dockerfile
│       └── package.json
├── kafka/
│   ├── docker-compose.yml
│   └── topics.sh
├── k8s/
│   ├── namespaces/
│   ├── deployments/
│   ├── services/
│   ├── ingress/
│   ├── configmaps/
│   └── secrets/
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   └── elk/
├── .github/
│   └── workflows/
│       └── ci-cd.yml
├── Jenkinsfile
├── docker-compose.yml
└── README.md
