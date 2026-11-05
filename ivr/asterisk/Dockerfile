FROM ubuntu:22.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      asterisk asterisk-moh-opsound-wav gettext-base curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY asterisk/pjsip.conf.tmpl asterisk/extensions.conf asterisk/rtp.conf asterisk/modules.conf /etc/asterisk/
COPY asterisk/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
