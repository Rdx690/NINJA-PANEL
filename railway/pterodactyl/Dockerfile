# Pterodactyl Panel image for Railway-based panel deployment.
# Railway runs the web panel only; Wings must run on a separate compatible Linux host.
ARG PTERODACTYL_VERSION=v1.15.1
FROM ghcr.io/pterodactyl/panel:${PTERODACTYL_VERSION}
COPY railway-client.cnf /etc/my.cnf.d/railway-client.cnf
COPY railway-start.sh /railway-start.sh
CMD ["/bin/ash", "/railway-start.sh"]
